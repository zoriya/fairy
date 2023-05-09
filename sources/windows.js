"use strict";

const Meta = imports.gi.Meta;
const GObject = imports.gi.GObject;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const Layout = Me.imports.sources.layout;

var WindowManager = GObject.registerClass(
	class WindowManager extends GObject.Object {
		_init() {
			super._init();
			this._layout = new Layout.Layout();
			log("fairy init");
		}

		disable() {
			Utils._disableDecorations();
			this._removeSignals();
		}

		enable() {
			this._bindSignals();
			this.render();
		}

		_bindSignals() {
			if (this._signalsBound) return;

			this._signals = [
				global.display.connect("window-created", (_display, window) => {
					// display: Meta.Display, window: Meta.Window
					const mon = window.get_monitor();
					const workspace = window.on_all_workspaces
						? ~0
						: window.get_workspace().index() + 1;
					log(`New window on monitor ${mon}, with tags: ${workspace}`);
					this._layout.newWindow(mon, workspace, window);
					this.render(mon, workspace);
				}),
			];
		}

		_removeSignals() {
			for (const signal of this._signals) {
				global.display.disconnect(signal);
			}
			this._signals = undefined;
		}

		/**
		 * @param {number?} mon
		 * @param {number?} workspace
		 */
		render(mon, workspace) {
			// if (!mon) {
			// 	for (const mon of [...Array(global.display.get_n_monitors().keys())])
			// 		this.render(mon);
			// 	return;
			// }
			// if (!workspace) {
			// 	// for (const work of )
			// 	// TODO: Loop on all workspaces of monitor;
			// 	this.render(mon, 1);
			// 	return;
			// }
			const monGeo = global.display.get_monitor_geometry(mon);
			for (const window of this._layout.render(mon, workspace)) {
				if (window.handle.get_monitor() !== mon)
					window.handle.move_to_monitor(mon);
				if (window.handle.minimized !== window.minimized) {
					if (window.minimized) window.handle.minimize();
					else window.handle.unminimize();
				}
				if (
					window.handle["maximized-vertically"] !=
					window.handle["maximized-horizontally"] ||
					window.handle["maximized-vertically"] != window.maximized
				) {
					if (window.maximized) window.handle.maximize(Meta.MaximizeFlags.BOTH);
					else window.handle.unmaximize(Meta.MaximizeFlags.BOTH);
				}

				// TODO: Add gaps
				log("Rezing percent: ", window.x, window.y, window.width, window.height);
				log("Resizing: ",
					monGeo.x + (window.x * monGeo.width) / 100,
					monGeo.y + (window.y * monGeo.height) / 100,
					(window.width * monGeo.width) / 100,
					(window.height * monGeo.height) / 100
				);

				// let cmpWindow = window.handle.get_compositor_private();
				// if (!cmpWindow) return;
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
