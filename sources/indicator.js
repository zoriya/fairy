"use strict";

const Gio = imports.gi.Gio;
const St = imports.gi.St;

const GObject = imports.gi.GObject;
const Main = imports.ui.main;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Clutter = imports.gi.Clutter;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

var Indicator = GObject.registerClass(
	class Indicator extends GObject.Object {
		_init(state, renderer, keybinds) {
			super._init();
			this._state = state;
			this._renderer = renderer;
			this._keybinds = keybinds;

			this._layoutIcons = {
				tiling: Gio.icon_new_for_string(`${Me.path}/icons/tiling.svg`),
				monocle: Gio.icon_new_for_string(`${Me.path}/icons/monocle.svg`),
				floating: Gio.icon_new_for_string(`${Me.path}/icons/floating.svg`),
				deck: Gio.icon_new_for_string(`${Me.path}/icons/deck.svg`),
			};
		}

		_createSelectableItem(title, cb) {
			const menuItem = new PopupMenu.PopupMenuItem(title, {});
			menuItem.connect("activate", cb);
			return menuItem;
		}

		enable() {
			this.settings = ExtensionUtils.getSettings(
				"org.gnome.shell.extensions.fairy"
			);

			const indicatorName = `${Me.metadata.name} Indicator`;
			this._layoutIndicator = new PanelMenu.Button(0.0, indicatorName);
			this._icon = new St.Icon({
				gicon: this._layoutIcons.tiling,
				style_class: "system-status-icon",
			});
			this._layoutIndicator.add_child(this._icon);

			const mon = global.display.get_primary_monitor();
			this._layoutPanelItems = {
				tiling: this._createSelectableItem("Tiling", () =>
					this._keybinds.switchLayout("tiling")
				),
				monocle: this._createSelectableItem("Monocle", () =>
					this._keybinds.switchLayout("monocle")
				),
				floating: this._createSelectableItem("Floating", () =>
					this._keybinds.switchLayout("floating")
				),
				deck: this._createSelectableItem("Deck", () =>
					this._keybinds.switchLayout("deck")
				),
			};
			this._layoutIndicator.menu.addMenuItem(this._layoutPanelItems.tiling);
			this._layoutIndicator.menu.addMenuItem(this._layoutPanelItems.monocle);
			this._layoutIndicator.menu.addMenuItem(this._layoutPanelItems.floating);
			this._layoutIndicator.menu.addMenuItem(this._layoutPanelItems.deck);

			this.settings.bind(
				"show-layout",
				this._layoutIndicator,
				"visible",
				Gio.SettingsBindFlags.DEFAULT
			);
			Main.panel.addToStatusArea(indicatorName, this._layoutIndicator);

			this.update();
		}

		disable() {
			this._layoutIndicator.destroy();
			this._layoutIndicator = null;
			this._icon.destroy();
			this._icon = null;

			this.settings = null;
		}

		update() {
			const primaryMon = global.display.get_primary_monitor();
			const layout = this._state.monitors[primaryMon].layout;
			log(layout);
			this._icon.gicon = this._layoutIcons[layout];

			for (const [key, value] of Object.entries(this._layoutPanelItems)) {
				value.setOrnament(
					key === layout ? PopupMenu.Ornament.DOT : PopupMenu.Ornament.NONE
				);
			}
		}
	}
);
