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
				tags: 0,
				layout: "tiling",
				oldLayout: "monocle",
				nmaster: 1,
				mfact: 55,
			}));

			// The currently focused monitor.
			this.focusedMon = 0;

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

			const gIdx = this.windows.findIndex((x) => x === windows[idx]);
			const gNewIdx = this.windows.findIndex((x) => x === windows[newIdx]);

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
			const windows = this.windows.filter(
				(x) => x.monitor === mon && x.tags & tags
			);
			log(`${windows.length} windows for monitor ${mon} with tags ${tags}`);
			return this._layout(this.monitors[mon], windows);
		}

		_layout({ layout, nmaster, mfact, focused }, windows) {
			const focusedW = windows.find((x) => x.handle === focused)
				?? windows[0];

			switch (layout) {
				case "monocle":
					if (!focusedW) return [];
					return [
						{
							...focusedW,
							handle: focusedW.handle,
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
							...x,
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
						...x,
						handle: x.handle,
						floating: true,
					}));
				case "deck":
					if (windows.length < 2) {
						return this._layout(
							{ layout: "tiling", nmaster, mfact, focused },
							windows
						);
					}
					const deckWindows =
						windows[0] === focusedW
							? windows.splice(0, 2)
							: [windows[0], focusedW];
					// Raise the window else lower docks can be above
					deckWindows[1].handle.raise();
					return this._layout(
						{ layout: "tiling", nmaster, mfact, focused },
						deckWindows
					);
				default:
					return [];
			}
		}
	}
);
