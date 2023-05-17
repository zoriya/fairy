"use strict";

const GObject = imports.gi.GObject;
const Main = imports.ui.main;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const ExtensionUtils = imports.misc.extensionUtils;

var KeyboardManager = GObject.registerClass(
	class KeyboardManager extends GObject.Object {
		_init(state, renderer, indicator) {
			super._init();
			this._state = state;
			this._renderer = renderer;
			this._indicator = indicator;
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
			this._addBinding("set-layout-tiling", () => this.switchLayout("tiling"));
			this._addBinding("set-layout-monocle", () =>
				this.switchLayout("monocle")
			);
			this._addBinding("set-layout-floating", () =>
				this.switchLayout("floating")
			);
			this._addBinding("set-layout-deck", () => this.switchLayout("deck"));

			this._addBinding("cycle-prev", () => {
				const mon = global.display.get_current_monitor();
				const state = this._state.monitors[mon];
				const idx = this._state.workIndexByHandle(state.focused);
				const newW = this._state.workIndex(mon, state.tags, idx + 1);
				if (newW && newW.handle !== state.focused) {
					this._renderer.focus(newW.handle);
					this._renderer.render(mon);
				}
			});
			this._addBinding("cycle-next", () => this._focusNext());

			this._addBinding("incrmfact", () => {
				const mon = global.display.get_current_monitor();
				const state = this._state.monitors[mon];
				state.mfact = Math.min(95, state.mfact + 5);
				this._renderer.render(mon);
				this._indicator.update(mon);
			});
			this._addBinding("decrmfact", () => {
				const mon = global.display.get_current_monitor();
				const state = this._state.monitors[mon];
				state.mfact = Math.max(5, state.mfact - 5);
				this._renderer.render(mon);
				this._indicator.update(mon);
			});

			this._addBinding("incrnmaster", () => {
				const mon = global.display.get_current_monitor();
				this._state.monitors[mon].nmaster += 1;
				this._renderer.render(mon);
				this._indicator.update(mon);
			});
			this._addBinding("decrnmaster", () => {
				const mon = global.display.get_current_monitor();
				if (this._state.monitors[mon].nmaster > 0)
					this._state.monitors[mon].nmaster -= 1;
				this._renderer.render(mon);
				this._indicator.update(mon);
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

			for (let tagNbr = 0; tagNbr < 9; tagNbr++) {
				const tag = 0b1 << tagNbr;

				this._addBinding(`set-tag-${tagNbr + 1}`, () => {
					const mon = global.display.get_current_monitor();
					this._renderer.setTags(mon, tag);
				});
				this._addBinding(`add-tag-${tagNbr + 1}`, () => {
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
				this._addBinding(`moveto-tag-${tagNbr + 1}`, () => {
					const mon = global.display.get_current_monitor();
					const handle = this._state.monitors[mon].focused;
					const window = this._state.windows.find((x) => x.handle === handle);
					if (!window) return;
					this._focusNext();
					window.tags = tag;
					window.handle.change_workspace_by_index(tagNbr, false);
					this._renderer.renderAll();
					this._indicator.update(mon);
				});
				this._addBinding(`addto-tag-${tagNbr + 1}`, () => {
					const mon = global.display.get_current_monitor();
					const handle = this._state.monitors[mon].focused;
					const window = this._state.windows.find((x) => x.handle === handle);
					if (!window) return;
					if (window.tags & tag) window.tags &= ~tag;
					else window.tags |= tag;
					this._renderer.renderAll();
					this._indicator.update(mon);
				});
			}
			this._addBinding("set-tag-all", () => {
				const mon = global.display.get_current_monitor();

				let takkenTags = 0;
				for (let i = 0; i < this._state.monitors.length; i++)
					takkenTags |= this._state.monitors[i].tags;

				this._state.monitors[mon].tags |= ~takkenTags;
				this._renderer.render(mon);
				this._indicator.update(mon);
			});
		}

		disable() {
			this._removeBinding("set-layout-tiling");
			this._removeBinding("set-layout-monocle");
			this._removeBinding("set-layout-floating");
			this._removeBinding("set-layout-deck");

			this._removeBinding("cycle-next");
			this._removeBinding("cycle-prev");

			this._removeBinding("incrmfact");
			this._removeBinding("decrmfact");
			this._removeBinding("incrnmaster");
			this._removeBinding("decrnmaster");

			this._removeBinding("swap-next");
			this._removeBinding("swap-prev");
			this._removeBinding("zoom");

			for (let i = 1; i < 10; i++) {
				this._removeBinding(`set-tag-${i}`);
				this._removeBinding(`add-tag-${i}`);
				this._removeBinding(`moveto-tag-${i}`);
				this._removeBinding(`addto-tag-${i}`);
			}
			this._removeBinding("set-tag-all");
		}

		switchLayout(mode) {
			const mon = global.display.get_current_monitor();
			const state = this._state.monitors[mon];
			const currentLayout = state.layout;
			if (state.layout === mode) state.layout = state.oldLayout;
			else state.layout = mode;
			state.oldLayout = currentLayout;
			this._renderer.render(mon);
			this._indicator.update(mon);
		}

		_focusNext() {
			const mon = global.display.get_current_monitor();
			const state = this._state.monitors[mon];
			const idx = this._state.workIndexByHandle(state.focused);
			const win = this._state.workIndex(mon, state.tags, idx - 1);
			if (win && win.handle !== state.focused) {
				this._renderer.focus(win.handle);
			} else {
				state.focused = null;
			}
			this._renderer.render(mon);
		}
	}
);
