"use strict";

const GObject = imports.gi.GObject;

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
				tags: 1,
				layout: "tiling",
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
			this.windows.push(this._windowFromHandle(handle));
			log("New window on tag", this.windows[this.windows.length - 1].tags);
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

		popByActor(actor) {
			const window = this.windows.find((x) => x.actor === actor);
			if (!window) return null;
			this.windows = this.windows.filter((x) => x !== window);
			return window;
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
							x: (i < nmaster || nmaster <= 0) ? 0 : mfact,
							y: stackIndex * (100 / stackLength),
							width:
								(windows.length <= nmaster || nmaster <= 0)
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
