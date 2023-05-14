"use strict";

const Meta = imports.gi.Meta;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

var Renderer = GObject.registerClass(
	class Renderer extends GObject.Object {
		_init(state) {
			super._init();
			this._state = state;
			log("fairy init!");
		}

		disable() {
			this._removeSignals();
		}

		enable() {
			this._bindSignals();

			for (const window of global.display.list_all_windows())
				this.trackWindow(window);

			const workspace = global.display
				.get_workspace_manager()
				.get_active_workspace_index();
			const tags = 0b1 << workspace;
			if (Meta.prefs_get_workspaces_only_on_primary()) {
				this._state.monitors[global.display.get_primary_monitor()].tags = tags;
			} else {
				for (let i = 0; i < this._state.monitors.length; i++)
					this._state.monitors[i].tags = tags;
			}

			this.renderAll();
		}

		/**
		 * @params {Meta.Window} handle
		 * @returns {boolean}
		 */
		_isValidWindow(handle) {
			// Check if we marked the window as invalid before (unmanaging call).
			if (handle._isInvalid) return false;

			let windowType = handle.get_window_type();
			return (
				windowType === Meta.WindowType.NORMAL ||
				windowType === Meta.WindowType.MODAL_DIALOG ||
				windowType === Meta.WindowType.DIALOG
			);
		}

		// Stolen from https://gitlab.gnome.org/GNOME/gnome-shell/-/merge_requests/183
		// Trying to move a newly-created window without using this (or waiting an arbitrary delay) crashes the gnome-shell.
		// @window: the metaWindow to wait for
		// @cb: the callback function called when the window is ready
		//
		// Waits until the actor of a metaWindow is available, it has
		// an allocation and a valid gtk-application-id.
		_waitForWindow(window, cb) {
			let windowActor;

			// Wait until window actor is available
			let waitForWindowId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
				// Stop if the window doesn't exist anymore or the parent is gone
				if (!window.get_workspace())
					return GLib.SOURCE_REMOVE;

				// Continue if there's no actor available yet
				if (!windowActor) {
					if (!window.get_compositor_private()) return GLib.SOURCE_CONTINUE;

					windowActor = window.get_compositor_private();
				}

				// Continue if the window is not allocated yet
				if (windowActor.visible && !windowActor.has_allocation())
					return GLib.SOURCE_CONTINUE;

				// HACK: Still runing the callback on a timeout because the window is now setup but not placed yet.
				// FIXME: Find a proper way to wait for this, I know forge is using a 220ms queue.
				Mainloop.timeout_add(100, cb);
				return GLib.SOURCE_REMOVE;
			});
			GLib.Source.set_name_by_id(
				waitForWindowId,
				"[gnome-shell] waitForWindow"
			);
		}

		_removeSignals() {
			for (const signal of this._displaySignals) {
				global.display.disconnect(signal);
			}
			this._displaySignals = undefined;

			for (const signal of this._workspaceSignals) {
				global.workspace_manager.disconnect(signal);
			}
			this._wmSignals = undefined;

			for (const window of this._state.windows) {
				if (window._signals) {
					for (const signal of window._signals) window.disconnect(signal);
				}
				let actor = window.handle.get_compositor_private();
				if (actor && actor._signals) {
					for (const signal of actor._signals) actor.disconnect(signal);
					actor._signals = [];
				}
			}
			this._state.windows = [];
		}

		_bindSignals() {
			this._displaySignals = [
				global.display.connect("window-created", (_display, window) =>
					this._waitForWindow(window, () => {
						this.trackWindow(window);
						this._state.focus(window);
						this.renderForWindow(window);
					})
				),
				// global.display.connect("window-entered-monitor", (_display, monitor, window) => {
				//
				// }),
			];
			this._workspaceSignals = [
				global.workspace_manager.connect("active-workspace-changed", () => {
					// Convert gnome workspaces to fairy's tags
					const workspace = global.display
						.get_workspace_manager()
						.get_active_workspace_index();
					const tags = 0b1 << workspace;
					log("Switch to tags", tags);
					if (Meta.prefs_get_workspaces_only_on_primary()) {
						const primaryMon = global.display.get_primary_monitor();
						this.setTag(primaryMon, tags);
					} else {
						for (let i = 0; i < this._state.monitors.length; i++) {
							this._state.monitors[i].tags = tags;
							this.render(i, tags);
						}
					}
				}),
			];
		}

		/**
		 * @param {Meta.Window} window
		 */
		trackWindow(window) {
			if (!this._isValidWindow(window)) return;
			// Add window signals
			window._signals = [
				window.connect("unmanaging", (handle) => {
					handle._isInvalid = true;
					const idx = this._state.workIndexByHandle(handle);
					const faWindow = this._state.popByHandle(handle);
					if (!faWindow) return;

					const tags = this._state.monitors[faWindow.monitor].tags;
					// Since we retrieved the idx, the window as been removed so we don't need to +1.
					const newWindow = this._state.workIndex(faWindow.monitor, tags, idx);
					if (newWindow) this._state.focus(newWindow.handle);

					this.render(faWindow.monitor, tags);
				}),
				window.connect("workspace-changed", (window) => {
					if (!this._isValidWindow(window)) return;
					const [oldW, newW] = this._state.updateByHandle(window);
					if (oldW) this.render(oldW.monitor, oldW.tags);
					if (newW) this.render(newW.monitor, newW.tags);
				}),
				window.connect("focus", (window) => {
					if (!this._isValidWindow(window)) return;
					this._state.monitors[window.get_monitor()].focused = window;
				}),
			];

			this._state.newWindow(window);
		}

		setTag(mon, tags) {
			const currTags = this._state.monitors[mon].tags;
			this._state.monitors[mon].tags = tags;
			this._setGWorkspaceIfNeeded(mon);

			for (const i = 0; i < this._state.monitors.length; i++) {
				if (this._state.monitors[i] & tags && mon !== i) {
					// Remove the selected tag from other monitors.
					// If the other monitor had only this tag, swap monitor's tags instead.
					this._state.monitors[i] = this._state.monitors[i] & ~tags || currTags;
					this._setGWorkspaceIfNeeded(i);
					this.render(i);
				}
			}

			this.render(mon);
		}

		_setGWorkspaceIfNeeded(mon) {
			if (mon !== global.display.get_primary_monitor()) return;

			const tags = this._state.monitors[mon].tags;
			// This retrieve the lower tag present in the tags set.
			const tag = (tags & ~(tags - 1));
			if (tags !== tag) return;
			// Retrieve the gnome workspace for the tag (inverse of 0b1 << tag)
			const workspace = Math.log2(tag) + 1;

			global.display
				.get_workspace_manager()
				.get_workspace_by_index(workspace)
				.activate(global.display.get_current_time());
		}

		renderAll() {
			const monN = global.display.get_n_monitors();
			for (let mon = 0; mon < monN; mon++) {
				this.render(mon, this._state.monitors[mon].tags);
			}
		}

		renderForWindow(window) {
			const mon = window.get_monitor();
			this.render(mon);
		}

		/**
		 * @param {number} mon
		 * @param {number?} tags
		 */
		render(mon, tags) {
			if (!tags) tags = this._state.monitors[mon].tags;

			// We don't care which workspace it is, we just want the geometry
			// for the current monitor without the panel.
			const monGeo = global.display
				.get_workspace_manager()
				.get_active_workspace()
				.get_work_area_for_monitor(mon);

			for (const window of this._state.render(mon, tags)) {
				if (window.handle.get_monitor() !== mon)
					window.handle.move_to_monitor(mon);

				if (window.floating) continue;

				if (window.handle.minimized !== window.minimized) {
					if (window.minimized) window.handle.minimize();
					else window.handle.unminimize();
				}
				if (
					window.handle["maximized-vertically"] !=
						window.handle["maximized-horizontally"] ||
					window.handle["maximized-vertically"] != window.maximized
				) {
					if (window.maximized) {
						window.handle.maximize(Meta.MaximizeFlags.BOTH);
						// Do not resize if maximizing to keep the overview tiled.
						continue;
					}
					else window.handle.unmaximize(Meta.MaximizeFlags.BOTH);
				}

				// TODO: Add gaps
				log(
					"Rezing percent: ",
					window.x,
					window.y,
					window.width,
					window.height,
					"Real values",
					monGeo.x + (window.x * monGeo.width) / 100,
					monGeo.y + (window.y * monGeo.height) / 100,
					(window.width * monGeo.width) / 100,
					(window.height * monGeo.height) / 100
				);

				// let cmpWindow = window.handle.get_compositor_private();
				// cmpWindow.remove_all_transitions();

				window.handle.move_resize_frame(
					true,
					monGeo.x + (window.x * monGeo.width) / 100,
					monGeo.y + (window.y * monGeo.height) / 100,
					(window.width * monGeo.width) / 100,
					(window.height * monGeo.height) / 100
				);
			}
		}
	}
);
