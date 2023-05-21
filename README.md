# Fairy

A dynamic tiling window manager for gnome. It is heavily inspired by DWM.

## Logic

Application's windows are stored in a list. This allows you to navigate via up/down key bindings (default to super J/K).
Layouts dynamically arrange window in a specific pattern, the default one, the tiling arrange windows in two areas: the master and the stack.
For other layouts, refer to the [layouts section](#Layouts).

Fairy also implements tags, which is a superset of workspaces, if you don't care you can keep using gnome's workspaces, it will work.
If you want to see what it looks like, see the [tag section](#Tags).


## Features

 - Dynamically change the layout (see [layouts](#Layouts)) for more
 - Gaps/Smart gaps
 - Selected window's border
 - Multi-monitor support
   - Implement tags (read workspace) for monitors other than the primary
   - Option to use only a single taglist for all monitors
 - Change the focus via keybinds
 - Rearrange window's order via keybinds

## Layouts

### Tiling

The tiling layout is arranged in two areas. The master and the stack areas.

The master contains the window that require focus now and takes a majority of the screen. The stack contains all the other
windows. You can change by keybinds how many windows should be in the master area (default is 1) and what percentage of the
screen the master area should take (default 55%).

### Deck

This is like the tiling layout but with only two windows at the same time. If there is more than two windows on your workspace,
they will be hidden on this layout. They can still be selected via keybindings or the overview but one of the visible window
will hide.

### Monocle

The selected window is in fullscreen, the others are not visible.

### Floating

Gnome's default mode, the extension is effectively disabled for a monitor in floating mode: all application can be moved
manually to your prefered size/position.


## Tags

Tags are a superset of workspaces, when you use a traditional workspace system you have a specific window on a specific workspace.

With tags, you can have windows with multiple tags and enable (think show) multiple tags at once.

If you have a terminal the tags 2 and 3, this terminal will appear on both the 2 and 3 workspace.

If you have discord with the tag 4, firefox with the tag 5 and chrome with the tag 6, you can either show a single tag
(with gnome's default navigation, the overview or a binding). So if you switch to the workspace 4, discord will show since
it is on the tag 4. If you know bring the tag 5 on top of the tag 4 (you can do so by pressing `<Super><ctrl>5` by default), you
will have both discord and firefox on the current layout.

## Bindings

I have not yet created a UI to change keybinds but they can be changed via dconf editor at `/org/gnome/shell/extensions/fairy/keybinds`.

Recommended binds:
 - Close window
 - Move window to monitor left/right

Conflicting binds:
 - Lock screen (`<Super>l`)
 - Hide window (`<Super>h`)
 - Switch to application [1-9] from dock (`<Super>[1-9]`)

### Layout bindings

| Default Keybind    | Action                                                             |
| ------------------ | ------------------------------------------------------------------ |
| `<Super>m`         | Set layout to monocle (only one window in fullscreen)              |
| `<Super>t`         | Set layout to tiling (this is the default layout)                  |
| `<Super>d`         | Set layout to deck (Like tiling but only display two windows)      |
| `<Super><Shift>f`  | Set layout to floating (Effectively disable the extension)         |
| `<Super>l`         | Increase the master area by 5%                                     |
| `<Super>h`         | Decrease the master area by 5%                                     |
| `<Super>i`         | Increase the number of window in the master are                    |
| `<Super>u`         | Decrease the number of window in the master are                    |

### Window bindings

| Default Keybind    | Action                                                             |
| ------------------ | ------------------------------------------------------------------ |
| `<Super>k`         | Cycle to the next window                                           |
| `<Super>j`         | Cycle to the previous window                                       |
| `<Super><Shift>k`  | Swap the current window with next                                  |
| `<Super><Shift>j`  | Swap the current window with previous                              |
| `<Super>Return`    | Swap the current window with the master                            |

### Tags bindings

| Default Keybind              | Action                                                              |
| ---------------------------- | ------------------------------------------------------------------- |
| `<Super>[1-9]`               | Switch to the selected tag/workspace for the current monitor        |
| `<Super>0`                   | Enable all tags                                                     |
| `<Super><Ctrl>[1-9]`         | Enable the select tag (add it to the currently active tags)         |
| `<Super><Shift>[1-9]`        | Move the focused window to the selected tag/worksapce               |
| `<Super><Ctrl><Shift>[1-9]`  | Add the focused window to the selected tag (keep all its other tags)|
