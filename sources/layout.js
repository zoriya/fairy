"use strict";

const GObject = imports.gi.GObject;

class FairyWindow {
	constructor(handle) {
		this.handle = handle;
		this.floating = false;
		this.fullscreen = false;
		this.monitor = 0;
		this.tags = 1;
	}
}

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

			this._layout = {
				type: "tiled",
				nmaster: 1,
				nfact: 60,
			};

			/**
			 * @type {FairyWindow[]}
			 */
			this._windows = [];
		}

		newWindow(mon, workspace, handle) {
			this._windows.push(new FairyWindow(handle));
			// this._monitors[mon] ??= new Map();
			// this._monitors[mon][workspace] ??= [];
			// this._monitors[mon][workspace].push(new FairyWindow(handle));
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
			const windows = this._windows.filter(
				(x) => x.monitor === mon && x.tags & tags
			);
			log(`${windows.length} windows for monitor ${mon} with tags ${tags}`);

			// TODO: Implement other layouts
			if (this._layout.type === "tiled") {
				return windows.map((x, i) => {
					const stackLength = i <= nmaster
						? Math.min(nmaster, windows.length)
						: window.length - nmaster;
					const stackIndex = i <= nmaster ? i : i - nmaster;
					return {
						handle: x.handle,
						maximized: false,
						minimized: false,
						x: i <= nmaster ? 0 : nfact,
						y: stackIndex * (100 - (100 / stackLength)),
						width: windows.length <= nmaster
							? 100
							: i <= nmaster
								? nfact
								: 100 - nfact,
						height: 100 / stackLength,
					};
				});
			}
		}
	}
);
