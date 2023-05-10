"use strict";

const Meta = imports.gi.Meta;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
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
			this._removeSignals();
		}

		enable() {
			this._bindSignals();
			// TODO: Add all existing windows to the layout and render.
			// this.render();
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
				if (!window.get_workspace() || !Main.overview.visible)
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
			for (const signal of this._signals) {
				global.display.disconnect(signal);
			}
			this._signals = undefined;

			for (const window of this._layout.windows) {
				let actor = window.handle.get_compositor_private();
				if (actor && actor._signals) {
					for (const signal of actor._signals) actor.disconnect(signal);
					actor._signals = [];
				}
			}
			this._layout.windows = [];
		}


		_bindSignals() {
			this._signals = [
				global.display.connect("window-created", (_display, window) =>
					this._waitForWindow(window, () => {
						this.trackWindow(window);
						this.renderForWindow(window);
					})
				),
			];
		}

		/**
		 * @param {Meta.Window} window
		 */
		trackWindow(window) {
			// Add window signals
			const actor = window.get_compositor_private();
			actor._signals = [
				actor.connect("destroy", (actor) => {
					const faWindow = this._layout.popByActor(actor);
					if (faWindow) this.render(faWindow.monitor, faWindow.tags);
				}),
			];

			this._layout.newWindow(window);
		}

		renderForWindow(window) {
			const mon = window.get_monitor();
			// TODO: The on_all_workspaces handling is faulty.
			const workspace = window.on_all_workspaces
				? ~0
				: window.get_workspace().index() + 1;
			this.render(mon, workspace);
		}

		/**
		 * @param {number} mon
		 * @param {number} tags
		 */
		render(mon, tags) {
			const monGeo = global.display.get_monitor_geometry(mon);
			for (const window of this._layout.render(mon, tags)) {
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
				log(
					"Rezing percent: ",
					window.x,
					window.y,
					window.width,
					window.height
				);
				log(
					"Resizing: ",
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
