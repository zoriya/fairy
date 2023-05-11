"use strict";

const GObject = imports.gi.GObject;

var Layout = GObject.registerClass(
	class Layout extends GObject.Object {
		_init() {
			super._init();
			// Simpler to set 30 monitors than track creation/supression of monitors.
			this._monitors = new Array(30).map(() => ({
				/**
				 * @type {Meta.Window} focused window's handle
				 */
				focused: null,
				layout: "tiled",
				nmaster: 1,
				nfact: 60,
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
		 * @returns WindowGeometry[]
		 */
		render(mon, tags) {
			const { layout, nmaster, nfact } = this._monitors[mon];
			const windows = this.windows.filter(
				(x) => x.monitor === mon && x.tags & tags
			);
			log(`${windows.length} windows for monitor ${mon} with tags ${tags}`);

			// TODO: Implement other layouts
			switch (layout) {
				case "monocle":
					return [
						{
							handle: this._monitors[mon].focused,
							maximized: true,
							minimized: false,
							x: 0,
							y: 0,
							width: 100,
							height: 100,
						},
					];
				case "tiled":
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
							x: i < nmaster ? 0 : nfact,
							y: stackIndex * (100 / stackLength),
							width:
								windows.length <= nmaster
									? 100
									: i < nmaster
										? nfact
										: 100 - nfact,
							height: 100 / stackLength,
						};
					});
			}
		}
	}
);
