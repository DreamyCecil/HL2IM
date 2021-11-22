/* Copyright (c) 2018-2021 Dreamy Cecil
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

// [Cecil] 2021-06-20: This file is for functions primarily used by PlayerBot class
#pragma once

#include "EntitiesMP/PlayerWeapons.h"

// [Cecil] 2018-10-12: Bot's weapon configuration
struct SBotWeaponConfig {
  WeaponType bw_wtType;   // current weapon
  FLOAT bw_fMinDistance;  // min (closest) distance to use it
  FLOAT bw_fMaxDistance;  // max (furthest) distance to use it
  FLOAT bw_fDamage;       // average damage
  FLOAT bw_fAccuracy;     // how accurate the weapon is
  FLOAT bw_fStrafe;       // at what percent of min to max distance to start strafing
  FLOAT bw_fSpecialRange; // at what percentage from max distance to use a special attack (negative for "closer than %", positive for "further than %")
  FLOAT bw_tmShotFreq;    // how frequently to spam the fire button (-1 or NO_FREQ to hold)
};

#define CT_BOT_WEAPONS WEAPON_LAST
#define NO_SPEC (0.0f)
#define NO_FREQ (-1.0f)

// [Cecil] 2018-10-12: Bot weapon priority (from best to worst)
extern SBotWeaponConfig _abwDeathmatchWeapons[CT_BOT_WEAPONS];
extern SBotWeaponConfig _abwCooperativeWeapons[CT_BOT_WEAPONS];

// Pick weapon config
inline SBotWeaponConfig *PickWeaponConfig(void) {
  if (GetSP()->sp_bCooperative || GetSP()->sp_bSinglePlayer) {
    return _abwCooperativeWeapons;
  }
  return _abwDeathmatchWeapons;
};

// --- Customizable helper functions

// Default weapons
#define WPN_DEFAULT_1 WEAPON_CROWBAR // increases running speed in deathmatch
#define WPN_DEFAULT_2 WEAPON_PISTOL

// Weapon flag from the weapon index
#define WPN_FLAG(_Weapon) (1 << (_Weapon - 1))

// Default weapon set
#define WPN_DEFAULT_MASK (WPN_FLAG(WPN_DEFAULT_1) | WPN_FLAG(WPN_DEFAULT_2))

// Has this weapon
#define WPN_EXISTS(_Plw, _Weapon) (_Plw->m_iAvailableWeapons & WPN_FLAG(_Weapon))

// Weapon has ammo
#define WPN_HAS_AMMO(_Plw, _Weapon) (_Plw->GetAmmo(_Weapon) > 0 || _Plw->GetMagCount(_Weapon) > 0 || _Plw->GetAltAmmoCount(_Weapon) > 0)

// Currently zooming in with a scope or not
BOOL UsingScope(CPlayerBot *pen);

// Able to use the scope or not
BOOL CanUseScope(CPlayerBot *pen);

// Use weapon scope for a bot now
void UseWeaponScope(CPlayerBot *pen, CPlayerAction &pa, SBotLogic &sbl);

// Fire the weapon now
void FireWeapon(CPlayerBot *pen, CPlayerAction &pa, SBotLogic &sbl);
