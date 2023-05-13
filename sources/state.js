"use strict";

const GObject = imports.gi.GObject;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;


var StateManager = GObject.registerClass(
	class StateManager extends GObject.Object {
		_init() {
			super._init();
			// Simpler to set 30 monitors than track creation/supression of monitors.
			this.monitors = [...new Array(30)].map(() => ({
				/**
				 * @type {Meta.Window} focused window's handle
				 */
				focused: null,
				/**
				 * @type {number | null} window's index that was focused just before a zoom
				 */
				beforeZoom: null,
				tags: 1,
				layout: "tiling",
				oldLayout: "monocle",
				nmaster: 1,
				mfact: 55,
			}));

			/**
			 * @type {FairyWindow[]}
			 */
			this.windows = [];
		}

		/**
		 * @param {Meta.Window} handle
		 * @returns {FairyWindow}
		 */
		_windowFromHandle(handle) {
			const mon = handle.get_monitor();
			const tags = handle.on_all_workspaces
				? ~0
				: 0b1 << handle.get_workspace().index();
			return {
				handle,
				monitor: mon,
				tags,
				// Needed for the popByActor that might get called when the actor is already deleted
				actor: handle.get_compositor_private(),
			};
		}

		/**
		 * @param {Meta.Window} handle
		 */
		newWindow(handle) {
			const window = this._windowFromHandle(handle);
			this.monitors[window.monitor].beforeZoom = null;
			log("New window on tag", window.tags);
			this.windows.unshift(window);
		}

		/**
		 * @param {Meta.Window} handle
		 * @returns {[FairyWindow, FairyWindow]} [old, new]
		 */
		updateByHandle(handle) {
			const i = this.windows.findIndex((x) => x.handle === handle);
			const old = { ...this.windows[i] };
			this.windows[i] = this._windowFromHandle(handle);
			return [old, this.windows[i]];
		}

		popByHandle(handle) {
			const window = this.windows.find((x) => x.handle === handle);
			if (!window) return null;
			this.monitors[window.monitor].beforeZoom = null;
			this.windows = this.windows.filter((x) => x !== window);
			return window;
		}

		/**
		 * @param {number} mon
		 * @param {number} tags
		 * @param {number} idx (will loop if over/under flow)
		 * @returns {FairyWindow}
		 */
		workIndex(mon, tags, idx) {
			const windows = this.windows.filter(
				(x) => x.monitor === mon && x.tags & tags
			);
			if (idx < 0) idx = windows.length + idx;
			return windows[idx % windows.length];
		}

		/**
		 * @param {Meta.Window} handle
		 * @returns {number} idx
		 */
		workIndexByHandle(handle) {
			const window = this.windows.find((x) => x.handle === handle);
			const windows = this.windows.filter(
				(x) => x.monitor === window.monitor && x.tags & window.tags
			);
			return windows.findIndex((x) => x.handle === handle);
		}

		/**
		 * @param {Meta.Window} handle
		 */
		focus(handle) {
			GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
				const mon = handle.get_monitor();
				this.monitors[mon].focused = handle;
				// This was focused without a zoom, removing the old zoom value.
				this.monitors[mon].beforeZoom = null;

				log("focusing window with title", handle.get_title());
				handle.raise();
				handle.focus(global.display.get_current_time());
				handle.activate(global.display.get_current_time());
				this.warpCursor(handle);
				// Do not retrigger this idle.
				return false;
			});
		}

		/**
		 * @param {Meta.Window} handle
		 */
		warpCursor(handle) {
			// TODO: Warp the cursor
			// TODO: Check if the warp-cursor setting is enabled.
		}

		/**
		 * @param {number} mon
		 * @param {number} tags
		 * @param {number} idx
		 * @param {number} newIdx (will loop if over/under flow)
		 */
		swap(mon, tags, idx, newIdx) {
			const windows = this.windows.filter(
				(x) => x.monitor === mon && x.tags & tags
			);
			if (newIdx < 0) newIdx = windows.length + newIdx;
			newIdx %= windows.length;

			const gIdx = this.windows.findIndex(x => x === windows[idx]);
			const gNewIdx = this.windows.findIndex(x => x === windows[newIdx]);

			const tmp = this.windows[gIdx];
			this.windows[gIdx] = this.windows[gNewIdx];
			this.windows[gNewIdx] = tmp;
		}

		/**
		 * @param {number} mon
		 * @param {number} tags
		 *
		 * @typedef WindowGeometry
		 * @type {object}
		 * @property {Meta.Window} handle
		 * @property {number} x - in percentage from the top left
		 * @property {number} y - in percentage from the top left
		 * @property {number} width - in percentage (0-100)
		 * @property {number} height - in percentage
		 * @property {boolean} minimized
		 * @property {boolean} maximized
		 * @property {boolean} floating
		 * @returns WindowGeometry[]
		 */
		render(mon, tags) {
			const { layout, nmaster, mfact } = this.monitors[mon];
			const windows = this.windows.filter(
				(x) => x.monitor === mon && x.tags & tags
			);
			log(`${windows.length} windows for monitor ${mon} with tags ${tags}`);

			// TODO: Implement other layouts
			switch (layout) {
				case "monocle":
					return [
						{
							handle: this.monitors[mon].focused,
							maximized: true,
							minimized: false,
							x: 0,
							y: 0,
							width: 100,
							height: 100,
						},
					];
				case "tiling":
					return windows.map((x, i) => {
						const stackLength =
							i < nmaster
								? Math.min(nmaster, windows.length)
								: windows.length - nmaster;
						const stackIndex = i < nmaster ? i : i - nmaster;
						return {
							handle: x.handle,
							maximized: false,
							minimized: false,
							x: i < nmaster || nmaster <= 0 ? 0 : mfact,
							y: stackIndex * (100 / stackLength),
							width:
								windows.length <= nmaster || nmaster <= 0
									? 100
									: i < nmaster
									? mfact
									: 100 - mfact,
							height: 100 / stackLength,
						};
					});
				case "floating":
					return windows.map((x) => ({
						handle: x.handle,
						floating: true,
					}));
				default:
					return [];
			}
		}
	}
);
