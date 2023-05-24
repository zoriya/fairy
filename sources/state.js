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

			this.sharedTagset = false;

			// The currently focused monitor.
			this.focusedMon = 0;

			/**
			 * @type {FairyWindow[]}
			 */
			this.windows = [];
		}

		/**
		 * @param {Meta.Window} handle
		 */
		newWindow(handle) {
			// Ignore windows that were already tracked before a disable/enable loop.
			if (this.windows.find((x) => x.handle === handle)) return;
			const mon = handle.get_monitor();
			const windowTags = 0b1 << handle.get_workspace().index();
			const window = {
				handle,
				monitor: mon,
				// If the window does not overlap monitor's tag, it could have been spawned
				// before the extension has been enabled so we trust the workspace instead of the tags.
				tags:
					this.monitors[mon].tags & windowTags
						? this.monitors[mon].tags
						: windowTags,
			};
			this.monitors[window.monitor].beforeZoom = null;
			log(
				"New window",
				window.handle.get_title(),
				"on tag",
				window.tags,
				"monitor",
				window.monitor
			);
			this.windows.unshift(window);
		}

		/**
		 * @param {Meta.Window} handle
		 * @returns {[FairyWindow, FairyWindow] | [null, null]} [old, new]
		 */
		updateByHandle(handle, tags) {
			const i = this.windows.findIndex((x) => x.handle === handle);
			if (i === -1) return [null, null];
			const old = { ...this.windows[i] };
			this.windows[i] = {
				handle,
				monitor: handle.get_monitor(),
				tags,
			};
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
				this.singleTagset
					? (x) => x.tags & tags
					: (x) => x.monitor === mon && x.tags & tags
			);
			if (idx < 0) idx = windows.length + idx;
			return windows[idx % windows.length];
		}

		/**
		 * @param {Meta.Window} handle
		 * @returns {number} idx or -1
		 */
		workIndexByHandle(handle) {
			const window = this.windows.find((x) => x.handle === handle);
			if (!window) return -1;
			const windows = this.windows.filter(
				this.singleTagset
					? (x) => x.tags & window.tags
					: (x) => x.monitor === window.monitor && x.tags & window.tags
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
				this.singleTagset
					? (x) => x.tags & tags
					: (x) => x.monitor === mon && x.tags & tags
			);
			if (newIdx < 0) newIdx = windows.length + newIdx;
			newIdx %= windows.length;

			const gIdx = this.windows.findIndex((x) => x === windows[idx]);
			const gNewIdx = this.windows.findIndex((x) => x === windows[newIdx]);

			const tmp = this.windows[gIdx];
			this.windows[gIdx] = this.windows[gNewIdx];
			this.windows[gNewIdx] = tmp;
		}

		findAvailableTag() {
			let takenTags = 0;
			for (let i = 0; i < global.display.get_n_monitor(); i++) {
				takenTags |= this.monitors[i].tags;
			}
			for (let i = 0; i < 9; i++) {
				if (takenTags & (0b1 << i === 0)) return 0b1 << i;
			}
			return 0;
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
				this.singleTagset
					? (x) => x.tags & tags
					: (x) => x.monitor === mon && x.tags & tags
			);
			log(`${windows.length} windows for monitor ${mon} with tags ${tags}`);
			return this._layout(this.monitors[mon], windows);
		}

		_layout({ layout, nmaster, mfact, focused }, windows) {
			const focusedW = windows.find((x) => x.handle === focused) ?? windows[0];

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
					if (windows.length <= 2) {
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
					// The last focused window is already raised so we dont need to raise it manually. This
					// also allows us to keep the previous focused window shown if the user switch back focus to master.
					// deckWindows[1].handle.raise();
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
