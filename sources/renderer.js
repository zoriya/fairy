"use strict";

const Meta = imports.gi.Meta;
const Gdk = imports.gi.Gdk;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;

const Main = imports.ui.main;
const Mainloop = imports.mainloop;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

var Renderer = GObject.registerClass(
	class Renderer extends GObject.Object {
		_init(state, settings, indicator, border) {
			super._init();
			this._state = state;
			this._settings = settings;
			this._indicator = indicator;
			this._border = border;
			this.gaps = {
				smart: true,
				size: 10,
				outerGaps: 20,
			};
			this.warpEnabled = true;
			log("fairy init!");
		}

		disable() {
			this._removeSignals();
		}

		enable() {
			this._bindSignals();

			this.gaps = {
				smart: this._settings.get_boolean("smart-gaps"),
				size: this._settings.get_uint("gap-size"),
				outerGaps: this._settings.get_uint("outer-gap-size"),
			};
			this.warpEnabled = this._settings.get_boolean("warp-cursor");
			this._state.singleTagset = this._settings.get_boolean("single-tagset");

			log("Enabling with state:", JSON.stringify(this._state.windows));
			for (const window of global.display.list_all_windows())
				this.trackWindow(window);

			const workspace = global.display
				.get_workspace_manager()
				.get_active_workspace_index();
			const tags = 0b1 << workspace;
			if (Meta.prefs_get_workspaces_only_on_primary()) {
				const primaryMon = global.display.get_primary_monitor();
				this._state.monitors[primaryMon].tags = tags;
				for (let i = 0; i < global.display.get_n_monitors(); i++) {
					if (primaryMon === i) continue;
					this._state.monitors[i].tags = 0b1 << i;
				}
			} else {
				for (let i = 0; i < global.display.get_n_monitors(); i++)
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
				if (!window.get_workspace()) return GLib.SOURCE_REMOVE;

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
			this._workspaceSignals = undefined;

			for (const window of this._state.windows) {
				if (window.handle._signals) {
					for (const signal of window.handle._signals) {
						window.handle.disconnect(signal);
					}
					window.handle._signals = undefined;
				}
			}
			// We do not remove the state's windows array, we want to keep tags when the user suspend the systme.

			this._settings.disconnect(this._settingsSignal);
		}

		_bindSignals() {
			log("Binding singals...");
			this._displaySignals = [
				global.display.connect("window-created", (_display, window) =>
					this._waitForWindow(window, () => {
						this.trackWindow(window);
						this.focus(window);
						this.renderForHandle(window);
						this._indicator.update();
					})
				),
				global.display.connect(
					"window-entered-monitor",
					(_display, monitor, handle) => {
						if (handle._ignoreMonitorChange) {
							handle._ignoreMonitorChange = false;
							return;
						}
						if (
							this._state.windows.find((x) => x.handle === handle)
								.monitor === monitor
						) {
							// Ignore monitor change to the same monitor. This happens when you close the lid of a laptop.
							log("Ignoring same monitor change", handle.get_title(), monitor);
							return;
						}
						const [oldW, newW] = this._state.updateByHandle(
							handle,
							this._state.monitors[monitor].tags
						);
						// Update by handle return null if the window is not tracked yet (new window).
						if (!oldW) return;
						log(
							"Monitor changed for window",
							newW.handle.get_title(),
							oldW.monitor,
							"to",
							newW.monitor
						);
						this.unfocus(handle);
						if (oldW) this.render(oldW.monitor);
						if (newW) this.render(newW.monitor);
						this._indicator.update();
					}
				),
				global.display.connect("workareas-changed", () => {
					const nmonitor = global.display.get_n_monitors();
					log("workarea-changed", nmonitor);
					if (nmonitor <= 0) return;
					for (let i = 0; i < nmonitor; i++) {
						if (this._state.monitors[i].tags !== 0) continue;
						this._state.monitors[i].tags = this._state.findAvailableTag();
					}
					// Clear selected tags of removed monitors.
					for (let i = nmonitor; i < this._state.monitors.length; i++) {
						this._state.monitors[i].tags = 0;
						this._state.monitors[i].focused = null;
					}
				}),
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
						this.setTags(primaryMon, tags);
					} else {
						for (let i = 0; i < global.display.get_n_monitors(); i++) {
							this._state.monitors[i].tags = tags;
							const focusedWindow = this._state.windows.find(
								(x) => x.handle === this._state.monitors[i].focused
							);
							if (!focusedWindow || !(focusedWindow.tags & tags))
								this._state.monitors[i].focused = null;
							this.render(i);
						}
					}
					this._indicator.update();
				}),
			];

			this._settingsSignal = this._settings.connect("changed", (_, key) => {
				log("Proprety changed", key);
				switch (key) {
					case "gap-size":
						this.gaps.size = this._settings.get_uint(key);
						this.renderAll();
						break;
					case "outer-gap-size":
						this.gaps.outerGaps = this._settings.get_uint(key);
						this.renderAll();
						break;
					case "smart-gaps":
						this.gaps.smart = this._settings.get_boolean(key);
						this.renderAll();
						break;
					case "warp-cursor":
						this.warpEnabled = this._settings.get_boolean(key);
						break;
					case "single-tagset":
						this._state.singleTagset = this._settings.get_boolean(key);
						const primaryMon = global.display.get_primary_monitor();
						for (let i = 0; i < global.display.get_n_monitors(); i++) {
							if (i === primaryMon) continue;
							this._state.monitors[i].tags = 0b1 << i;
						}
						this.renderAll();
						this._indicator.update();
						break;
				}
			});
		}

		/**
		 * @param {Meta.Window} handle
		 */
		trackWindow(handle) {
			if (!this._isValidWindow(handle)) return;
			// Add window signals
			handle._signals = [
				handle.connect("unmanaging", (handle) => {
					handle._isInvalid = true;
					const idx = this._state.workIndexByHandle(handle);
					const faWindow = this._state.popByHandle(handle);
					if (!faWindow) return;

					if (
						this._state.monitors[faWindow.monitor].focused === faWindow.handle
					) {
						const tags = this._state.monitors[faWindow.monitor].tags;
						// Since we retrieved the idx, the window as been removed so we don't need to +1.
						const newWindow = this._state.workIndex(
							faWindow.monitor,
							tags,
							idx
						);
						if (newWindow) this.focus(newWindow.handle);
						else {
							this._state.monitors[faWindow.monitor].focused = null;
						}
					}

					this.render(faWindow.monitor);
					this._indicator.update();
				}),
				handle.connect("workspace-changed", (handle) => {
					if (handle._ignoreWorkspaceChange) {
						log("Ignoring workspace change for", handle.get_title());
						handle._ignoreWorkspaceChange = false;
						return;
					}
					if (!this._isValidWindow(handle)) return;
					// Ignore workspace change on other monitors since workspaces are only on the primary monitor.
					if (handle.get_monitor() !== global.display.get_primary_monitor())
						return;

					const [oldW, newW] = this._state.updateByHandle(
						handle,
						0b1 << handle.get_workspace().index()
					);
					if (!oldW) return;
					log(
						"Workspace changed for window",
						newW.handle.get_title(),
						oldW.tags,
						"to",
						newW.tags
					);
					this.unfocus(handle);
					if (oldW) this.render(oldW.monitor);
					if (newW) this.render(newW.monitor);
					this._indicator.update();
				}),
				handle.connect("focus", (handle) => {
					if (!this._isValidWindow(handle)) return;
					const mon = handle.get_monitor();
					this._state.monitors[mon].focused = handle;
					this._state.focusedMon = mon;
					this.renderForHandle(handle);
					this._indicator.update();
				}),
				handle.connect("position-changed", () => this._border.updateBorders()),
				handle.connect("size-changed", () => this._border.updateBorders()),
				handle.connect("raised", () => this._border.updateBorders()),
				handle.connect("shown", () => this._border.updateBorders()),
			];

			this._state.newWindow(handle);
		}

		unfocus(handle) {
			log("NMonitor", global.display.get_n_monitors());
			for (let i = 0; i < global.display.get_n_monitors(); i++) {
				if (this._state.monitors[i].focused !== handle) continue;
				this._state.monitors[i].focused = null;
			}
		}

		/**
		 * @param {Meta.Window} handle
		 */
		focus(handle) {
			const mon = handle.get_monitor();
			this._state.monitors[mon].focused = handle;
			// This was focused without a zoom, removing the old zoom value.
			this._state.monitors[mon].beforeZoom = null;

			log("focusing window with title", handle.get_title());
			handle.raise();
			handle.focus(global.display.get_current_time());
			handle.activate(global.display.get_current_time());
			this.warpCursor(handle);
			this._border.updateBorders();
		}

		/**
		 * @param {Meta.Window} handle
		 */
		warpCursor(handle) {
			if (!this.warpEnabled) return;

			const gdkDisplay = Gdk.DisplayManager.get().get_default_display();
			if (!gdkDisplay) return;
			const rect = handle.get_frame_rect();
			log("Warping to x,y", rect.x, rect.y);
			gdkDisplay
				.get_default_seat()
				.get_pointer()
				.warp(
					gdkDisplay.get_default_screen(),
					rect.x + rect.width / 2,
					rect.y + rect.height / 2
				);
			log("warped");
		}

		setTags(mon, tags) {
			const currTags = this._state.monitors[mon].tags;
			const focusedWindow = this._state.windows.find(
				(x) => x.handle === this._state.monitors[mon].focused
			);
			if (!focusedWindow || !(focusedWindow.tags & tags))
				this._state.monitors[mon].focused = null;
			this._state.monitors[mon].tags = tags;
			this._setGWorkspaceIfNeeded(mon);

			if (this._state.singleTagset) {
				for (let i = 0; i < global.display.get_n_monitors(); i++) {
					if (this._state.monitors[i].tags & tags && mon !== i) {
						// Remove the selected tag from other monitors.
						// If the other monitor had only this tag, swap monitor's tags instead.
						this._state.monitors[i].tags =
							this._state.monitors[i].tags & ~tags || currTags;

						// If the monitor's focused window is removed from the monitor, unfocus it.
						// For now, the focus is simply set to null and hopefully gnome will automatically refocus somethign else.
						const focusedW = this._state.windows.find(
							(x) => x.handle === this._state.monitors[i].focused
						);
						if (focusedW && focusedW.tags & this._state.monitors[i].tags)
							this._state.monitors[i].focused = null;

						this._setGWorkspaceIfNeeded(i);
						this.render(i);
					}
				}
			}

			this.render(mon);
			this._indicator.update(mon);
		}

		_tagToGWorkspace(tags) {
			// This retrieve the lower tag present in the tags set.
			const tag = tags & ~(tags - 1);
			// Retrieve the gnome workspace for the tag (inverse of 0b1 << tag)
			return Math.log2(tag);
		}

		_setGWorkspaceIfNeeded(mon) {
			if (mon !== global.display.get_primary_monitor()) return;

			const tags = this._state.monitors[mon].tags;
			const workspace = this._tagToGWorkspace(tags);
			// Do not switch g workspace if we simply bring another tag.
			if (tags !== 0b1 << workspace) return;
			log("Switching to", tags, workspace);

			global.display
				.get_workspace_manager()
				.get_workspace_by_index(workspace)
				.activate(global.display.get_current_time());
		}

		renderAll() {
			const monN = global.display.get_n_monitors();
			for (let mon = 0; mon < monN; mon++) {
				this.render(mon);
			}
		}

		renderForHandle(handle) {
			const mon = handle.get_monitor();
			this.render(mon);
		}

		/**
		 * @param {number} mon
		 */
		render(mon) {
			const tags = this._state.monitors[mon].tags;

			// We don't care which workspace it is, we just want the geometry
			// for the current monitor without the panel.
			const monGeo = global.display
				.get_workspace_manager()
				.get_active_workspace()
				.get_work_area_for_monitor(mon);
			const workIdx = global.display
				.get_workspace_manager()
				.get_active_workspace_index();

			const windows = this._state.render(mon, tags);
			for (const window of windows) {
				if (window.handle.get_monitor() !== mon) {
					window.handle._ignoreMonitorChange = true;
					window.handle.move_to_monitor(mon);
				}
				if (window.handle.get_workspace().index() !== workIdx) {
					// The window is visible because another tag as been bringed
					// so we need to ask gnome to move windows (temporarly to the current workspace)
					log("Invalid workspace", window.tags, 0b1 << workIdx);
					window.handle._ignoreWorkspaceChange = true;
					window.handle.change_workspace_by_index(workIdx, true);
				}

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
						window.handle.raise();
						// Do not resize if maximizing to keep the overview tiled.
						continue;
					} else window.handle.unmaximize(Meta.MaximizeFlags.BOTH);
				}

				let size = {
					x: (window.x * monGeo.width) / 100,
					y: (window.y * monGeo.height) / 100,
					width: (window.width * monGeo.width) / 100,
					height: (window.height * monGeo.height) / 100,
				};

				if (
					this._state.monitors[mon].layout !== "monocle" &&
					(windows.length > 1 || !this.gaps.smart)
				)
					size = this.addGaps(size, monGeo);

				// Doing a simple move after because gnome ignore move_resize calls if the available space is less
				// then what the application requests.
				window.handle.move_frame(true, monGeo.x + size.x, monGeo.y + size.y);

				window.handle.move_resize_frame(
					true,
					monGeo.x + size.x,
					monGeo.y + size.y,
					size.width,
					size.height
				);
			}

			const primaryMon = global.display.get_primary_monitor();
			// This list all windows that exists, not only visible ones.
			// TODO: Check if this is okay and if not, edit this.
			for (const handle of global.display.list_all_windows()) {
				// Ignore windows that we just moved in.
				if (windows.find((x) => x.handle === handle)) continue;

				const window = this._state.windows.find((x) => x.handle === handle);
				if (mon !== primaryMon && handle.get_monitor() === mon) {
					// Move all windows present on external monitors that should not be.
					// This allows the gnome's preview to display tags.
					log("Monitor cleanup", primaryMon, handle.get_monitor());
					handle._ignoreMonitorChange = true;
					handle.move_to_monitor(primaryMon);
				}

				if (!(window.tags & (0b1 << workIdx))) {
					// We probably just deselected a tag so we bring back windows to their old workspace for the preview.
					log("Workspace cleanup", window.tags, 0b1 << workIdx);
					window.handle._ignoreWorkspaceChange = true;
					window.handle.change_workspace_by_index(
						this._tagToGWorkspace(window.tags),
						true
					);
				}
			}

			this._border.updateBorders();
		}

		addGaps(window, monGeo) {
			const gapSize = this.gaps.size;
			// Inner gaps are applied two times so to make outers the same visual size we 2x
			const outerGaps = this.gaps.outerGaps * 2;

			return {
				...window,
				x: window.x === 0 ? outerGaps : window.x + gapSize,
				y: window.y === 0 ? outerGaps : window.y + gapSize,
				width:
					window.width -
					(window.x === 0 ? outerGaps : gapSize) -
					(Math.round(window.x + window.width) === Math.round(monGeo.width)
						? outerGaps
						: gapSize),
				height:
					window.height -
					(window.y === 0 ? outerGaps : gapSize) -
					(Math.round(window.y + window.height) === Math.round(monGeo.height)
						? outerGaps
						: gapSize),
			};
		}
	}
);
