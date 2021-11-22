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
#include "StdH.h"

#include "BotFunctions.h"
#include "BotWeapons.h"

// [Cecil] NOTE: These can be manually adjusted for a specific mod. Order doesn't matter,
//               it's only for better understanding of the desired priority.

// [Cecil] 2018-10-12: Bot weapon priority (from best to worst)
extern SBotWeaponConfig _abwDeathmatchWeapons[CT_BOT_WEAPONS] = {
  //    Weapon Type         Min D    Max D     DMG   Accuracy  Strafe  Special  Frequency
  { WEAPON_CROSSBOW,         8.0f,  300.0f,  150.0f,  0.80f,   0.30f,  NO_SPEC,  NO_FREQ}, // 13
  { WEAPON_G3SG1,            0.0f,   32.0f,  100.0f,  0.95f,   0.50f,  NO_SPEC,  NO_FREQ}, // 5
  { WEAPON_AR2,              0.0f,  300.0f,  100.0f,  0.70f,   0.25f,   -0.05f,  NO_FREQ}, // 7
  { WEAPON_SPAS,             0.0f,   40.0f,  100.0f,  0.70f,   0.25f,    -0.4f,  NO_FREQ}, // 4
  { WEAPON_SMG1,             0.0f,  500.0f,   20.0f,  0.80f,   0.10f,   -0.02f,  NO_FREQ}, // 6
  { WEAPON_LASER,            0.0f,  128.0f,   40.0f,  0.60f,   0.20f,  NO_SPEC,  NO_FREQ}, // 12
  { WEAPON_IRONCANNON,      16.0f,  128.0f,  300.0f,  0.40f,   0.20f,  NO_SPEC,  NO_FREQ}, // 14
  { WEAPON_GRENADE,          8.0f,  128.0f,  100.0f,  0.30f,   0.20f,   -0.25f,     0.2f}, // 9
  { WEAPON_RPG,             12.0f,  256.0f,  300.0f,  0.20f,   0.20f,  NO_SPEC,     0.5f}, // 8
  { WEAPON_FLAMER,           0.0f,   24.0f,   30.0f,  0.80f,   0.50f,  NO_SPEC,  NO_FREQ}, // 11
  { WEAPON_GRAVITYGUN,       0.0f,   10.0f,   50.0f,  1.00f,   0.00f,  NO_SPEC,     0.2f}, // 10
  { WEAPON_CROWBAR,          0.0f,    5.0f,   20.0f,  1.00f,   0.00f,  NO_SPEC,  NO_FREQ}, // 1
  { WEAPON_357,              0.0f,  500.0f,   50.0f,  0.85f,   0.00f,  NO_SPEC,  NO_FREQ}, // 3
  { WEAPON_PISTOL,           0.0f,  500.0f,   10.0f,  0.85f,   0.00f,  NO_SPEC,     0.1f}, // 2
  { WEAPON_NONE,             0.0f,    0.0f,    0.0f,  0.00f,   0.00f,  NO_SPEC,  NO_FREQ}, // 0
};

extern SBotWeaponConfig _abwCooperativeWeapons[CT_BOT_WEAPONS] = {
  //    Weapon Type         Min D    Max D     DMG   Accuracy  Strafe  Special  Frequency
  { WEAPON_IRONCANNON,      24.0f,  128.0f,  200.0f,  0.40f,   0.20f,  NO_SPEC,  NO_FREQ}, // 14
  { WEAPON_AR2,              0.0f,  500.0f,  200.0f,  0.70f,   0.25f,   -0.05f,  NO_FREQ}, // 7
  { WEAPON_CROSSBOW,         8.0f,  300.0f,  100.0f,  0.80f,   0.30f,  NO_SPEC,  NO_FREQ}, // 13
  { WEAPON_LASER,            0.0f,  256.0f,  100.0f,  0.60f,   0.20f,  NO_SPEC,  NO_FREQ}, // 12
  { WEAPON_GRENADE,          8.0f,  128.0f,  150.0f,  0.40f,   0.20f,   -0.25f,     0.2f}, // 9
  { WEAPON_RPG,             12.0f,  256.0f,  300.0f,  0.20f,   0.20f,  NO_SPEC,     0.5f}, // 8
  { WEAPON_FLAMER,           0.0f,   24.0f,   60.0f,  0.80f,   0.50f,  NO_SPEC,  NO_FREQ}, // 11
  { WEAPON_SMG1,             0.0f,  500.0f,  100.0f,  0.80f,   0.10f,   -0.02f,  NO_FREQ}, // 6
  { WEAPON_G3SG1,            0.0f,   32.0f,   70.0f,  0.95f,   0.50f,  NO_SPEC,  NO_FREQ}, // 5
  { WEAPON_SPAS,             0.0f,   40.0f,  100.0f,  0.70f,   0.25f,    -0.4f,  NO_FREQ}, // 4
  { WEAPON_GRAVITYGUN,       0.0f,   10.0f,  100.0f,  1.00f,   0.00f,  NO_SPEC,     0.2f}, // 10
  { WEAPON_CROWBAR,          0.0f,    5.0f,   20.0f,  1.00f,   0.00f,  NO_SPEC,  NO_FREQ}, // 1
  { WEAPON_357,              0.0f,  500.0f,   50.0f,  0.85f,   0.00f,  NO_SPEC,  NO_FREQ}, // 3
  { WEAPON_PISTOL,           0.0f,  500.0f,   10.0f,  0.85f,   0.00f,  NO_SPEC,     0.1f}, // 2
  { WEAPON_NONE,             0.0f,    0.0f,    0.0f,  0.00f,   0.00f,  NO_SPEC,  NO_FREQ}, // 0
};

// Currently zooming in with a scope or not
BOOL UsingScope(CPlayerBot *pen) {
  return pen->GetPlayerWeapons()->m_iSniping != 0;
};

// Able to use the scope or not
BOOL CanUseScope(CPlayerBot *pen) {
  return (pen->GetPlayerWeapons()->m_iCurrentWeapon == WEAPON_CROSSBOW
       || pen->GetPlayerWeapons()->m_iCurrentWeapon == WEAPON_G3SG1);
};

// Use weapon scope for a bot
void UseWeaponScope(CPlayerBot *pen, CPlayerAction &pa, SBotLogic &sbl) {
  // unable to press the button this tick
  if (!pen->ButtonAction()) {
    return;
  }

  CPlayerWeapons *penWeapons = pen->GetPlayerWeapons();

  // zoom in if enemy is visible
  if (!UsingScope(pen) && sbl.SeeEnemy()) {
    pa.pa_ulButtons |= PLACT_ALTFIRE;

  // zoom out if can't see the enemy
  } else if (UsingScope(pen) && !sbl.SeeEnemy()) {
    pa.pa_ulButtons |= PLACT_ALTFIRE;
  }
};

// Fire the weapon now
void FireWeapon(CPlayerBot *pen, CPlayerAction &pa, SBotLogic &sbl) {
  SBotWeaponConfig &bwWeapon = sbl.aWeapons[pen->m_iBotWeapon];
  CPlayerWeapons *penWeapons = pen->GetPlayerWeapons();

  BOOL bUseSpecial = FALSE;
  FLOAT &fSpecial = bwWeapon.bw_fSpecialRange;

  // can use special at some range
  if (fSpecial != 0.0f) {
    // if further than the reversed percentage
    if (fSpecial < 0.0f) {
      bUseSpecial = (pen->m_fTargetDist <= bwWeapon.bw_fMaxDistance * -fSpecial);

    // if closer than the percentage
    } else {
      bUseSpecial = (pen->m_fTargetDist >= bwWeapon.bw_fMaxDistance * fSpecial);
    }
  }

  INDEX *piAlt = penWeapons->GetAltAmmo(bwWeapon.bw_wtType);
  BOOL bAlt = (piAlt != NULL ? penWeapons->GetAltAmmoCount(bwWeapon.bw_wtType)
                             : penWeapons->GetAmmo(bwWeapon.bw_wtType)) > 0;

  // use special
  if (bUseSpecial && bAlt) {
    // [Cecil] NOTE: Vanilla has no specials, it can be a secondary fire or some ability in a mod
    pa.pa_ulButtons |= PLACT_ALTFIRE;

  // just shoot
  } else {
    pa.pa_ulButtons |= PLACT_FIRE;
  }
};
