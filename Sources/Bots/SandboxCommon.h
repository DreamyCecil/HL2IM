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

// [Cecil] 2019-06-02: This file is for common elements and functions from the mod
#pragma once

#include "Engine/Network/NetworkMessage.h"

// Start with 49 to continue the NetworkMessageType list
enum ECecilPackets {
  MSG_CECIL_SANDBOX = 49, // sandbox action
};

// [Cecil] 2019-05-28: Sandbox Action Types
enum ESandboxAction {
  ESA_ADDBOT, // add a new bot
  ESA_REMBOT, // remove a bot
  ESA_UPDATEBOT, // update bot settings

  ESA_SETWEAPONS, // change all weapons in the world

  ESA_NAVMESH_GEN,   // generate Navigation Mesh
  ESA_NAVMESH_STATE, // save or load the NavMesh
  ESA_NAVMESH_CLEAR, // clear the NavMesh
  
  // [Cecil] 2019-11-07: NavMesh Editing Actions
  ESA_NAVMESH_CREATE,   // add a new path point
  ESA_NAVMESH_DELETE,   // delete a path point
  ESA_NAVMESH_CONNECT,  // connect two points
  ESA_NAVMESH_UNTARGET, // untarget one point from another
  ESA_NAVMESH_TELEPORT, // move the point to the player

  ESA_NAVMESH_POS,    // change point's position
  ESA_NAVMESH_SNAP,   // snap point's position
  ESA_NAVMESH_FLAGS,  // change point's flags
  ESA_NAVMESH_ENTITY, // change point's entity
  ESA_NAVMESH_RANGE,  // change point's range
  ESA_NAVMESH_NEXT,   // chabge point's next important point
};

// [Cecil] 2020-07-28: A structure for bot settings
struct DECL_DLL SBotSettings {
  INDEX b3rdPerson; // Set third person view
  INDEX iCrosshair; // Preferred crosshair (-1 for random)

  INDEX bSniperZoom;    // Use sniper zoom or not
  INDEX bShooting;      // Attack or not
  FLOAT fShootAngle;    // Maximum attack angle
  FLOAT fAccuracyAngle; // Target angle accuracy
  
  FLOAT fRotSpeedDist;  // Maximum distance for the difference
  FLOAT fRotSpeedMin;   // Minimal rotation speed multiplier
  FLOAT fRotSpeedMax;   // Maximum rotation speed multiplier
  FLOAT fRotSpeedLimit; // Maximum rotation speed limit
  
  FLOAT fWeaponCD; // Weapon selection cooldown
  FLOAT fTargetCD; // Target selection cooldown
  
  FLOAT fSpeedMul; // Speed multiplier
  INDEX bStrafe;   // Strafe near the target or not
  INDEX bJump;     // Jump or not
  
  FLOAT fPrediction; // Position prediction multiplier
  FLOAT fPredictRnd; // Prediction randomness
  
  INDEX iAllowedWeapons;  // Allowed weapons for the bot (-1 = everything is allowed)
  INDEX iTargetType;      // Target type (0 - players, 1 - enemies, 2 - both)
  INDEX bTargetSearch;    // Search for a target or not
  FLOAT fImportantChance; // How often to pick important points
  INDEX bItemSearch;      // Search for items or not
  FLOAT fItemSearchCD;    // Item search cooldown
  
  INDEX bItemVisibility; // Check for item's visibility or not
  FLOAT fWeaponDist;     // Weapon search distance
  FLOAT fHealthSearch;   // Start health searching below this HP
  FLOAT fHealthDist;     // Health search distance
  FLOAT fArmorDist;      // Armor search distance
  FLOAT fAmmoDist;       // Ammo search distance

  // Constructor
  SBotSettings(void) {
    Reset();
  };

  // Reset settings
  void Reset(void) {
    b3rdPerson = TRUE;
    iCrosshair = -1;

    bSniperZoom = TRUE;
    bShooting = TRUE;
    fShootAngle = 15.0f;
    fAccuracyAngle = 5.0f;
  
    fRotSpeedDist = 400.0f;
    fRotSpeedMin = 0.05f;
    fRotSpeedMax = 0.2f;
    fRotSpeedLimit = 30.0f;
  
    fWeaponCD = 3.0f;
    fTargetCD = 1.0f;
  
    fSpeedMul = 1.0f;
    bStrafe = TRUE;
    bJump = TRUE;
  
    fPrediction = 0.1f;
    fPredictRnd = 0.1f;
  
    iAllowedWeapons = -1;
    iTargetType = -1;
    bTargetSearch = TRUE;
    fImportantChance = 0.2f;
    bItemSearch = TRUE;
    fItemSearchCD = 5.0f;
  
    bItemVisibility = TRUE;
    fWeaponDist = 16.0f;
    fHealthSearch = 100.0f;
    fHealthDist = 32.0f;
    fArmorDist = 16.0f;
    fAmmoDist = 16.0f;
  };

  #define WRITE_SETTINGS(_Var) \
    _Var << sbs.b3rdPerson    << sbs.iCrosshair \
         << sbs.bSniperZoom   << sbs.bShooting     << sbs.fShootAngle     << sbs.fAccuracyAngle \
         << sbs.fRotSpeedDist << sbs.fRotSpeedMin  << sbs.fRotSpeedMax    << sbs.fRotSpeedLimit \
         << sbs.fWeaponCD     << sbs.fTargetCD     << sbs.fSpeedMul       << sbs.bStrafe << sbs.bJump \
         << sbs.fPrediction   << sbs.fPredictRnd   << sbs.iAllowedWeapons << sbs.iTargetType \
         << sbs.bTargetSearch << sbs.fImportantChance \
         << sbs.bItemSearch   << sbs.fItemSearchCD << sbs.bItemVisibility << sbs.fHealthSearch \
         << sbs.fWeaponDist   << sbs.fHealthDist   << sbs.fArmorDist      << sbs.fAmmoDist

  #define READ_SETTINGS(_Var) \
    _Var >> sbs.b3rdPerson    >> sbs.iCrosshair \
         >> sbs.bSniperZoom   >> sbs.bShooting     >> sbs.fShootAngle     >> sbs.fAccuracyAngle \
         >> sbs.fRotSpeedDist >> sbs.fRotSpeedMin  >> sbs.fRotSpeedMax    >> sbs.fRotSpeedLimit \
         >> sbs.fWeaponCD     >> sbs.fTargetCD     >> sbs.fSpeedMul       >> sbs.bStrafe >> sbs.bJump \
         >> sbs.fPrediction   >> sbs.fPredictRnd   >> sbs.iAllowedWeapons >> sbs.iTargetType \
         >> sbs.bTargetSearch >> sbs.fImportantChance \
         >> sbs.bItemSearch   >> sbs.fItemSearchCD >> sbs.bItemVisibility >> sbs.fHealthSearch \
         >> sbs.fWeaponDist   >> sbs.fHealthDist   >> sbs.fArmorDist      >> sbs.fAmmoDist

  // Stream operations
  friend CTStream &operator<<(CTStream &strm, SBotSettings &sbs) {
    WRITE_SETTINGS(strm);
    return strm;
  };
  
  friend CTStream &operator>>(CTStream &strm, SBotSettings &sbs) {
    READ_SETTINGS(strm);
    return strm;
  };
  
  // Message operations
  friend CNetworkMessage &operator<<(CNetworkMessage &nm, SBotSettings &sbs) {
    WRITE_SETTINGS(nm);
    return nm;
  };
  
  friend CNetworkMessage &operator>>(CNetworkMessage &nm, SBotSettings &sbs) {
    READ_SETTINGS(nm);
    return nm;
  };

  #undef WRITE_SETTINGS
  #undef READ_SETTINGS
};

// --- Helper functions

// [Cecil] 2019-06-02: Function from Serious Gang mod that returns amount of numbers in the fraction
DECL_DLL INDEX FractionNumbers(FLOAT fNumber);

// [Cecil] 2019-06-02: Convert float number into the string without extra zeros
DECL_DLL inline CTString FloatToStr(const FLOAT &f);

// [Cecil] 2019-06-04: Convert unsigned long into a binary number
DECL_DLL CTString ULongToBinary(ULONG ul);

// [Cecil] 2019-06-05: Return file name with extension
DECL_DLL CTString FileNameWithExt(CTString strFileName);

// [Cecil] 2020-07-29: Project 3D line onto 2D space
DECL_DLL BOOL ProjectLine(CProjection3D *ppr, FLOAT3D vPoint1, FLOAT3D vPoint2, FLOAT3D &vOnScreen1, FLOAT3D &vOnScreen2);

// [Cecil] 2018-10-28: Finds an entity by its ID
DECL_DLL CEntity *FindEntityByID(CWorld *pwo, const INDEX &iEntityID);

// [Cecil] 2018-10-11: Distance Length Function
inline FLOAT DistanceToPos(FLOAT3D vPos1, FLOAT3D vPos2) {
  return (vPos1 - vPos2).Length();
};

// [Cecil] 2021-06-14: Check if item is pickable
DECL_DLL BOOL IsItemPickable(class CPlayer *pen, class CItem *penItem, const BOOL &bCheckDist);

// [Cecil] 2021-06-16: Determine vertical position difference
DECL_DLL FLOAT3D VerticalDiff(FLOAT3D vPosDiff, const FLOAT3D &vGravityDir);

// [Cecil] 2021-06-14: Determine position difference on the same plane
DECL_DLL FLOAT3D HorizontalDiff(FLOAT3D vPosDiff, const FLOAT3D &vGravityDir);

// [Cecil] 2021-06-28: Get relative angles from the directed placement
DECL_DLL FLOAT GetRelH(const CPlacement3D &pl);
DECL_DLL FLOAT GetRelP(const CPlacement3D &pl);

// [Cecil] 2020-07-29: Do the ray casting with specific passable flags
DECL_DLL void CastRayFlags(CCastRay &cr, CWorld *pwoWorld, ULONG ulPass);

// [Cecil] 2018-10-15: Check if polygon is suitable for walking on
DECL_DLL BOOL FlatPolygon(CWorld *wo, CBrushPolygon *pbpo);

// [Cecil] Check if entity is of given DLL class
DECL_DLL BOOL IsOfDllClass(CEntity *pen, const CDLLEntityClass &dec);

// [Cecil] Check if entity is of given DLL class or derived from it
DECL_DLL BOOL IsDerivedFromDllClass(CEntity *pen, const CDLLEntityClass &dec);

// --- Replacement functions

// [Cecil] 2021-06-17: Check if an entity exists
#define ASSERT_ENTITY(_Entity) (_Entity != NULL && !(_Entity->GetFlags() & ENF_DELETED))

// [Cecil] 2021-06-12: Looping through players and bots
DECL_DLL INDEX CECIL_GetMaxPlayers(void);
DECL_DLL CPlayer *CECIL_GetPlayerEntity(const INDEX &iPlayer);

#define GET_PLAYER(_Player, _Index) \
  CPlayer *_Player = CECIL_GetPlayerEntity(_Index); \
  if (!ASSERT_ENTITY(_Player)) continue;

// [Cecil] 2021-06-13: Get personal player index
DECL_DLL INDEX CECIL_PlayerIndex(CPlayer *pen);

// [Cecil] Check player and bot entities
#define IS_PLAYER(_Entity) IsDerivedFromDllClass(_Entity, CPlayer_DLLClass)
