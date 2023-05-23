"use strict";

const Meta = imports.gi.Meta;
const Gdk = imports.gi.Gdk;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const St = imports.gi.St;

const Main = imports.ui.main;
const Mainloop = imports.mainloop;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

var BorderManager = GObject.registerClass(
	class BorderManager extends GObject.Object {
		_init(state, settings) {
			super._init();
			this._state = state;
			this._settings = settings;
			this._border = null;
			this._renderCount = 0;
			this.settings = {
				show: true,
				color: "#ff0000",
			};
		}

		enable() {
			this.settings = {
				show: this._settings.get_boolean("focus-border"),
				color: this._settings.get_string("focus-border-color"),
			};

			this._border = new St.Bin({
				style: `border-color: ${this.settings.color};`,
				style_class: "fairy-border",
			});
			if (global.window_group) global.window_group.add_child(this._border);

			this._settings.connect("changed", () => {
				this.settings = {
					show: this._settings.get_boolean("focus-border"),
					color: this._settings.get_string("focus-border-color"),
				};
				this._border.set_style(`border-color: ${this.settings.color};`);
				this.updateBorders();
			});
		}

		disable() {
			log("Removing the border");
			this._settings.disconnect("changed");
			this._border.destroy();
			this._border = null;
		}

		updateBorders() {
			if (!this._border) return;

			// Hide the border during transitions.
			this._border.hide();
			this._renderCount++;

			if (!this.settings.show) return;

			const state = this._state.monitors[this._state.focusedMon];
			const handle = state.focused;
			if (!handle || state.layout === "monocle") return;
			if (
				state.layout !== "floating" &&
				this._state.windows.filter(
					(x) => x.monitor === this._state.focusedMon && x.tags & state.tags
				).length === 1
			)
				return;
			if (handle.get_window_type() !== Meta.WindowType.NORMAL) return;

			const rc = this._renderCount;
			Mainloop.timeout_add(200, () => {
				// If the updateBorders has already been recalled, dont show the border in the first call.
				// The windows have probably already change place/been refocused.
				if (rc !== this._renderCount) return;

				const rect = handle.get_frame_rect();
				const inset = 2;
				this._border.set_size(rect.width + inset * 2, rect.height + inset * 2);
				this._border.set_position(rect.x - inset, rect.y - inset);
				this._border.show();
			});
		}
	}
);
