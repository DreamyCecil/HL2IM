/* Copyright (c) 2024 Dreamy Cecil
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

#ifndef CECIL_INCL_MATERIALS_H
#define CECIL_INCL_MATERIALS_H

#ifdef PRAGMA_ONCE
  #pragma once
#endif

// Surface types
enum ECecilSurfaceType {
  ESRT_NORMAL,
  ESRT_SLIDING,
  ESRT_NOIMPACT,
  ESRT_SLOPE,

  ESRT_LAST,
};

// New surface definition
#define NEW_SURFACE(Type, Offset) \
  SUR_##Type##_NORMAL   = SURFACE_LAST_VANILLA + Offset * ESRT_LAST + 0, \
  SUR_##Type##_SLIDING  = SURFACE_LAST_VANILLA + Offset * ESRT_LAST + 1, \
  SUR_##Type##_NOIMPACT = SURFACE_LAST_VANILLA + Offset * ESRT_LAST + 2, \
  SUR_##Type##_SLOPE    = SURFACE_LAST_VANILLA + Offset * ESRT_LAST + 3

// New surface definition in an editable enum
#define NEW_ENUM_SURFACE(Type) \
  EP_ENUMVALUE(SUR_##Type##_NORMAL,   #Type), \
  EP_ENUMVALUE(SUR_##Type##_SLIDING,  #Type " sliding"), \
  EP_ENUMVALUE(SUR_##Type##_NOIMPACT, #Type " no impact"), \
  EP_ENUMVALUE(SUR_##Type##_SLOPE,    #Type " high slope")

// Check for the material in a switch-case block
#define MATERIAL_CASES(Type) \
     SUR_##Type##_NORMAL:   \
case SUR_##Type##_SLIDING:  \
case SUR_##Type##_NOIMPACT: \
case SUR_##Type##_SLOPE

#define MATERIAL_VAR(Type) SUR_##Type##_NORMAL

// Surface types as an editable enum type
enum EWorldSurfaceType {
  // Vanilla surfaces
  SURFACE_SAND           =  9,
  SURFACE_WATER          = 12,
  SURFACE_RED_SAND       = 13,
  SURFACE_GRASS          = 17,
  SURFACE_GRASS_SLIDING  = 19,
  SURFACE_GRASS_NOIMPACT = 20,
  SURFACE_WOOD           = 18,
  SURFACE_SNOW           = 21,

  // Types for vanilla surfaces
  SURFACE_STONE                     =  0,
  SURFACE_ICE                       =  1,
  SURFACE_STONE_NOSTEP              =  2,
  SURFACE_STONE_HIGHSTAIRS          =  3,
  SURFACE_ICE_CLIMBABLESLOPE        =  4,
  SURFACE_ICE_SLIDINGSLOPE          =  5,
  SURFACE_ICE_LESSSLIDING           =  6,
  SURFACE_ROLLERCOASTER             =  7,
  SURFACE_LAVA                      =  8,
  SURFACE_CLIMBABLESLOPE            = 10,
  SURFACE_STONE_NOIMPACT            = 11,
  SURFACE_ICE_SLIDINGSLOPE_NOIMPACT = 14,
  SURFACE_ROLLERCOASTER_NOIMPACT    = 15,
  SURFACE_STONE_HIGHSTAIRS_NOIMPACT = 16,

  // New special surfaces
  SURFACE_WOOD_SLIDING = 22,
  SURFACE_WOOD_SLOPE   = 23,

  // Last default surface (don't use)
  SURFACE_LAST_VANILLA,

  // New surfaces
  NEW_SURFACE(METAL,       0),
  NEW_SURFACE(METAL_GRATE, 1),
  NEW_SURFACE(CHAINLINK,   2),
  NEW_SURFACE(TILES,       3),
  NEW_SURFACE(GLASS,       4),
  NEW_SURFACE(PLASTIC,     5),
  NEW_SURFACE(WEAPON,      6),

  // Last overall surface (don't use)
  SURFACE_LAST_OVERALL,
};

#define CT_NEW_SURFACES 5

extern DECL_DLL CEntityPropertyEnumType EWorldSurfaceType_enum;

inline void ClearToDefault(EWorldSurfaceType &e) {
  e = (EWorldSurfaceType)0;
};

// Get surface type for a non-brush entity (-1 if unknown)
INDEX GetSurfaceForEntity(CEntity *pen);

// Get valid surface type for a non-brush entity
inline INDEX GetValidSurfaceForEntity(CEntity *pen) {
  const INDEX iSurface = GetSurfaceForEntity(pen);
  return (iSurface == -1 ? SURFACE_STONE : iSurface);
};

// Load and resave materials of the world
BOOL LoadMaterials(CWorld *pwo);
void SaveMaterials(void);
void UnloadMaterials(void);

// Switch between material configs
void SwitchMaterialConfig(INDEX iConfig);

// Apply existing materials to the world
BOOL ApplyMaterials(BOOL bWorld, BOOL bFirstTime);

// Set material for this polygon
void SetMaterial(INDEX iLayer, INDEX iMat);

// Remove material from the list
void RemoveMaterial(INDEX iLayer);

// Help with functions
void MaterialsHelp(void);

#endif
