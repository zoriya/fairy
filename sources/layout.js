"use strict";

const GObject = imports.gi.GObject;

var Layout = GObject.registerClass(
	class Layout extends GObject.Object {
		_init() {
			super._init();
			// /**
			//  * Map<monitorIndex, Map<workspaceNbr - 0 for all, Window>>
			//  * @type {Map<number, Map<number, FairyWindow[]>>}
			//  */
			// this._monitors = new Map();
			//
			// /**
			//  * The
			//  * @type {Map<number, number>}
			//  */
			// this._monitorsTags = new Map();

			// TODO: duplicate this layout for each monitors.
			this._layout = {
				type: "tiled",
				nmaster: 1,
				nfact: 60,
			};

			/**
			 * @type {FairyWindow[]}
			 */
			this.windows = [];
		}

		newWindow(handle) {
			const mon = handle.get_monitor();
			const tags = handle.on_all_workspaces
				? ~0
				: handle.get_workspace().index() + 1;
			this.windows.push({
				handle,
				monitor: mon,
				tags,
				// Needed for the popByActor that might get called when the actor is already deleted
				actor: handle.get_compositor_private(),
			});
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
			const { nmaster, nfact } = this._layout;
			const windows = this.windows.filter(
				(x) => x.monitor === mon && x.tags & tags
			);
			log(`${windows.length} windows for monitor ${mon} with tags ${tags}`);

			// TODO: Implement other layouts
			if (this._layout.type === "tiled") {
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
