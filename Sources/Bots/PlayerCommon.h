/* Copyright (c) 2021 Dreamy Cecil
This program is free software; you can redistribute it and/or modify
it under the terms of version 2 of the GNU General Public License as published by
the Free Software Foundation


This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License along
with this program; if not, write to the Free Software Foundation, Inc.,
51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA. */

// [Cecil] NOTE: Copy mod-defined flags and button actions from Player.es to here

// Player flags
#define PLF_INITIALIZED           (1UL<<0)   // set when player entity is ready to function
#define PLF_VIEWROTATIONCHANGED   (1UL<<1)   // for adjusting view rotation separately from legs
#define PLF_JUMPALLOWED           (1UL<<2)   // if jumping is allowed
#define PLF_SYNCWEAPON            (1UL<<3)   // weapon model needs to be synchronized before rendering
#define PLF_AUTOMOVEMENTS         (1UL<<4)   // complete automatic control of movements
#define PLF_DONTRENDER            (1UL<<5)   // don't render view (used at end of level)
#define PLF_CHANGINGLEVEL         (1UL<<6)   // mark that we next are to appear at start of new level
#define PLF_APPLIEDACTION         (1UL<<7)   // used to detect when player is not connected
#define PLF_NOTCONNECTED          (1UL<<8)   // set if the player is not connected
#define PLF_LEVELSTARTED          (1UL<<9)   // marks that level start time was recorded
#define PLF_ISZOOMING             (1UL<<10)  // marks that player is zoomed in with the sniper
#define PLF_RESPAWNINPLACE        (1UL<<11)  // don't move to marker when respawning (for current death only)

// Defines representing flags used to fill player buttoned actions
#define PLACT_FIRE            (1L<<0)
#define PLACT_RELOAD          (1L<<1)
#define PLACT_WEAPON_NEXT     (1L<<2)
#define PLACT_WEAPON_PREV     (1L<<3)
#define PLACT_WEAPON_FLIP     (1L<<4)
#define PLACT_USE             (1L<<5)
#define PLACT_COMPUTER        (1L<<6)
#define PLACT_3RD_PERSON_VIEW (1L<<7)
#define PLACT_CENTER_VIEW     (1L<<8)
#define PLACT_USE_HELD        (1L<<9)
// [Cecil] Different zoom
#define PLACT_ZOOM       (1L<<10)
#define PLACT_SNIPER_USE (1L<<11)
// [Cecil] Removed FIREBOMB because it doesn't exist anymore
#define PLACT_FLASHLIGHT (1L<<12)
#define PLACT_ALTFIRE    (1L<<13)
#define PLACT_MENU       (1L<<14)
#define PLACT_SELECT_WEAPON_SHIFT (15)
#define PLACT_SELECT_WEAPON_MASK  (0x1FL<<PLACT_SELECT_WEAPON_SHIFT)

// [Cecil] NOTE: These are taken from Player.es, where they should be defined as "extern" instead of "static"
extern FLOAT plr_fMoveSpeed;
extern FLOAT plr_fSpeedUp;
