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
		_init() {
			super._init();

			this._layoutIcons = {
				tiling: Gio.icon_new_for_string(`${Me.path}/icons/tiling.svg`),
				monocle: Gio.icon_new_for_string(`${Me.path}/icons/monocle.svg`),
				floating: Gio.icon_new_for_string(`${Me.path}/icons/floating.svg`),
				deck: Gio.icon_new_for_string(`${Me.path}/icons/deck.svg`),
			};
		}

		endInit(ext) {
			this._state = ext._state;
			this._renderer = ext._renderer;
			this._keybinds = ext._keybinds;
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

			const tagIndicatorName = `${Me.metadata.name} Tag Indicator`;
			this._tagIndicator = new PanelMenu.Button(0.0, tagIndicatorName);
			this.settings.bind(
				"show-tags",
				this._tagIndicator,
				"visible",
				Gio.SettingsBindFlags.DEFAULT
			);

			const indicatorName = `${Me.metadata.name} Layout Indicator`;
			this._layoutIndicator = new PanelMenu.Button(0.0, indicatorName);
			this._icon = new St.Icon({
				gicon: this._layoutIcons.tiling,
				style_class: "system-status-icon",
			});
			this._layoutIndicator.add_child(this._icon);

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
			this._nmasterPanelItem = new PopupMenu.PopupMenuItem("nmaster", {});
			this._mfactPanelItem = new PopupMenu.PopupMenuItem("mfact", {});
			this._layoutIndicator.menu.addMenuItem(this._layoutPanelItems.tiling);
			this._layoutIndicator.menu.addMenuItem(this._layoutPanelItems.monocle);
			this._layoutIndicator.menu.addMenuItem(this._layoutPanelItems.floating);
			this._layoutIndicator.menu.addMenuItem(this._layoutPanelItems.deck);
			this._layoutIndicator.menu.addMenuItem(
				new PopupMenu.PopupSeparatorMenuItem()
			);
			this._layoutIndicator.menu.addMenuItem(this._nmasterPanelItem);
			this._layoutIndicator.menu.addMenuItem(this._mfactPanelItem);

			this.settings.bind(
				"show-layout",
				this._layoutIndicator,
				"visible",
				Gio.SettingsBindFlags.DEFAULT
			);

			Main.panel.addToStatusArea(
				indicatorName,
				this._layoutIndicator,
				1,
				"left"
			);
			Main.panel.addToStatusArea(
				tagIndicatorName,
				this._tagIndicator,
				1,
				"left"
			);
			this.update();
		}

		disable() {
			this._tagIndicator.destroy_all_children();
			this._tagIndicator.destroy();
			this._tagIndicator = null;

			this._layoutPanelItems = {};
			this._nmasterPanelItem = null;
			this._mfactPanelItem = nulll;
			for (const item of this._layoutIndicator.menu) item.destroy();
			this._layoutIndicator.destroy();
			this._layoutIndicator = null;
			this._icon.destroy();
			this._icon = null;

			this.settings = null;
		}

		update() {
			const mon = global.display.get_primary_monitor();
			const state = this._state.monitors[mon];

			// TODO: Retrieve the following two from the settings.
			const tagName = [];
			const activeColor = "#ff0000";

			this._tagIndicator.destroy_all_children();
			let tagBox = new St.BoxLayout();
			this._tagIndicator.add_child(tagBox);
			for (let tagNbr = 0; tagNbr < 9; tagNbr++) {
				const tag = 0b1 << tagNbr;
				const active = state.tags & tag;
				const hasWindow =
					this._state.windows.find((x) => x.tags & tag) !== undefined;
				if (!active && !hasWindow) continue;
				const style = "width: 30px;";
				const tagBtn = new St.Button({
					can_focus: true,
					style: active ? `${style} background-color: ${activeColor};` : style,
				});
				tagBtn.set_child(
					new St.Label({
						x_align: Clutter.ActorAlign.CENTER,
						y_align: Clutter.ActorAlign.CENTER,
						text: tagName[tagNbr] ?? (tagNbr + 1).toString(),
					})
				);
				tagBtn.connect("clicked", () => this._renderer.setTags(mon, tag));
				tagBox.add_child(tagBtn);
			}

			this._icon.gicon = this._layoutIcons[state.layout];
			for (const [key, value] of Object.entries(this._layoutPanelItems)) {
				value.setOrnament(
					key === state.layout
						? PopupMenu.Ornament.DOT
						: PopupMenu.Ornament.NONE
				);
			}
			this._nmasterPanelItem.label.text = `nmaster: ${state.nmaster}`;
			this._mfactPanelItem.label.text = `mfact: ${state.mfact}%`;
		}
	}
);
