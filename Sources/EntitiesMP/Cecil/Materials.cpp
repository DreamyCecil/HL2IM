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

#include "StdH.h"
#include "Materials.h"

#include <EntitiesMP/Mod/PhysBase.h>

#include <XGizmo/Base/IniConfig.h>

// Surface types as an editable enum type
EP_ENUMBEG(EWorldSurfaceType)
  EP_ENUMVALUE(SURFACE_STONE,                     "Standard"),
  EP_ENUMVALUE(SURFACE_ICE,                       "Ice"),
  EP_ENUMVALUE(SURFACE_STONE_NOSTEP,              "Standard - no step"),
  EP_ENUMVALUE(SURFACE_STONE_HIGHSTAIRS,          "Standard - high stairs"),
  EP_ENUMVALUE(SURFACE_ICE_CLIMBABLESLOPE,        "Ice climbable slope"),
  EP_ENUMVALUE(SURFACE_ICE_SLIDINGSLOPE,          "Ice sliding slope"),
  EP_ENUMVALUE(SURFACE_ICE_LESSSLIDING,           "Ice less sliding"),
  EP_ENUMVALUE(SURFACE_ROLLERCOASTER,             "Roller coaster"),
  EP_ENUMVALUE(SURFACE_LAVA,                      "Lava"),
  EP_ENUMVALUE(SURFACE_SAND,                      "Sand"),
  EP_ENUMVALUE(SURFACE_CLIMBABLESLOPE,            "Clibamble Slope"),
  EP_ENUMVALUE(SURFACE_STONE_NOIMPACT,            "Standard - no impact"),
  EP_ENUMVALUE(SURFACE_WATER,                     "Water"),
  EP_ENUMVALUE(SURFACE_RED_SAND,                  "Red sand"),
  EP_ENUMVALUE(SURFACE_ICE_SLIDINGSLOPE_NOIMPACT, "Ice sliding slope no impact"),
  EP_ENUMVALUE(SURFACE_ROLLERCOASTER_NOIMPACT,    "Roller coaster no impact"),
  EP_ENUMVALUE(SURFACE_STONE_HIGHSTAIRS_NOIMPACT, "Standard - high stairs no impact"),
  EP_ENUMVALUE(SURFACE_GRASS,                     "Grass"),
  EP_ENUMVALUE(SURFACE_WOOD,                      "Wood"),
  EP_ENUMVALUE(SURFACE_GRASS_SLIDING,             "Grass sliding"),
  EP_ENUMVALUE(SURFACE_GRASS_NOIMPACT,            "Grass no impact"),
  EP_ENUMVALUE(SURFACE_SNOW,                      "Snow"),
  EP_ENUMVALUE(SURFACE_WOOD_SLIDING,              "Wood sliding"),
  EP_ENUMVALUE(SURFACE_WOOD_SLOPE,                "Wood high slope"),

  // New surfaces
  NEW_ENUM_SURFACE(METAL),
  NEW_ENUM_SURFACE(METAL_GRATE),
  NEW_ENUM_SURFACE(CHAINLINK),
  NEW_ENUM_SURFACE(TILES),
  NEW_ENUM_SURFACE(GLASS),
EP_ENUMEND(EWorldSurfaceType);

// Get surface type for a non-brush entity (-1 if unknown)
INDEX GetSurfaceForEntity(CEntity *pen) {
  if (IsDerivedFromID(pen, CPhysBase_ClassID)) {
    return ((CPhysBase &)*pen).GetPhysMaterial();
  }

  // Unknown entity
  return -1;
};

// Loaded materials
static CIniConfig _iniGlobal;
static CIniConfig _iniWorld;
static CIniConfig *_piniCurrent = NULL;

#define GLOBAL_MATERIALS_CONFIG "Scripts\\GlobalMaterials.ini"

static CWorld *_pwoConfigWorld = NULL;
static CTString _strCurrentConfig = GLOBAL_MATERIALS_CONFIG;

// Save and load materials of the world
BOOL LoadMaterials(CWorld *pwo) {
  // Unload current materials if they're still loaded
  if (_piniCurrent != NULL && !_piniCurrent->IsEmpty()) {
    UnloadMaterials();
  }

  _pwoConfigWorld = pwo;
  const CTFileName fnWorld = CTString("Scripts\\LevelMaterials\\" + pwo->wo_fnmFileName.FileName()+".ini");

  // load the config
  try {
    _iniWorld.Load_t(fnWorld, TRUE);
    _strCurrentConfig = fnWorld;
    _piniCurrent = &_iniWorld;

    // apply global materials if needed
    if (_iniWorld.GetBoolValue("Properties", "LoadGlobal", FALSE)) {
      try {
        _iniGlobal.Load_t(GLOBAL_MATERIALS_CONFIG, TRUE);
        _strCurrentConfig = GLOBAL_MATERIALS_CONFIG;
        _piniCurrent = &_iniGlobal;

      } catch (char *strError) {
        CPrintF(" Couldn't load global config: %s\n", strError);
        CPrintF(" Only using world config.\n");
      }
    }

    return TRUE;

  // load global config instead
  } catch (char *strError) {
    (void)strError;
    //CPrintF(" Couldn't load world config: %s\n", strError);
    //CPrintF(" Trying to load global config instead.\n");
  }

  try {
    _iniGlobal.Load_t(GLOBAL_MATERIALS_CONFIG, TRUE);
    _strCurrentConfig = GLOBAL_MATERIALS_CONFIG;
    _piniCurrent = &_iniGlobal;
    return TRUE;

  } catch (char *strError) {
    // delete if couldn't load
    CPrintF(" Couldn't load global config: %s\n", strError);
    _iniGlobal.Clear();
    _iniWorld.Clear();
  }

  return FALSE;
};

void UnloadMaterials(void) {
  if (_piniCurrent == NULL) return;

  _iniGlobal.Clear();
  _iniWorld.Clear();

  _piniCurrent = NULL;
  _pwoConfigWorld = NULL;
  _strCurrentConfig = GLOBAL_MATERIALS_CONFIG;
};

void SaveMaterials(void) {
  if (_piniCurrent->IsEmpty()) {
    CPrintF(" Materials aren't loaded!\n");
    return;
  }

  try {
    _piniCurrent->Save_t(_strCurrentConfig);
    CPrintF(" Resaved config into '%s'\n", _strCurrentConfig.str_String);

  } catch (char *strError) {
    CPrintF(" Couldn't resave '%s':\n%s\n", _strCurrentConfig.str_String, strError);
  }
};

// Switch between material configs
void SwitchMaterialConfig(INDEX iConfig) {
  switch (iConfig) {
    // level config
    case 1:
      _strCurrentConfig = CTString("Scripts\\LevelMaterials\\" + _pwoConfigWorld->wo_fnmFileName.FileName()+".ini");
      _piniCurrent = &_iniWorld;

      // load level config
      try {
        _iniWorld.Load_t(_strCurrentConfig, TRUE);
        CPrintF(" Switched to level config (%s)\n", _strCurrentConfig.str_String);

      // just create a new one if couldn't load
      } catch (char *strError) {
        CPrintF(" Couldn't load world config: %s\n", strError);
        CPrintF(" Creating a new config: %s\n", _strCurrentConfig.str_String);

        // mark it to use global config
        if (!_piniCurrent->KeyExists("Properties", "LoadGlobal")) {
          _piniCurrent->SetBoolValue("Properties", "LoadGlobal", TRUE);
        }
      }
      break;

    // global config
    default:
      _strCurrentConfig = GLOBAL_MATERIALS_CONFIG;
      _piniCurrent = &_iniGlobal;

      // load global config
      try {
        _iniGlobal.Load_t(_strCurrentConfig, TRUE);
        CPrintF(" Switched to global config (%s)\n", GLOBAL_MATERIALS_CONFIG);

      // just create a new one if couldn't load
      } catch (char *strError) {
        CPrintF(" Couldn't load global config: %s\n", strError);
        CPrintF(" Creating a new config: %s\n", GLOBAL_MATERIALS_CONFIG);
      }
  }
};

// Relevant materials and their names
const char *_astrMaterials[] = {
  "STONE", "SAND", "WATER", "RED_SAND", "GRASS", "WOOD", "SNOW", "METAL", "METAL_GRATE", "CHAINLINK", "TILES", "GLASS",
};

static INDEX _aiMaterials[] = {
  SURFACE_STONE, SURFACE_SAND, SURFACE_WATER, SURFACE_RED_SAND, SURFACE_GRASS, SURFACE_WOOD, SURFACE_SNOW,
  MATERIAL_VAR(METAL), MATERIAL_VAR(METAL_GRATE), MATERIAL_VAR(CHAINLINK), MATERIAL_VAR(TILES), MATERIAL_VAR(GLASS),
};

static const INDEX _ctMaterials = ARRAYCOUNT(_aiMaterials);

// Find material of a specific texture
static INDEX FindTextureMaterial(CIniConfig &ini, const CTFileName &fnTex) {
  // Go through all the materials (skip stone - 0)
  for (INDEX i = 1; i < _ctMaterials; i++) {
    // Check full path and then just the filename
    if (ini.GetValue("Materials", fnTex.str_String, "") == _astrMaterials[i]
     || ini.GetValue("Materials", fnTex.FileName().str_String, "") == _astrMaterials[i]) {
      return i;
    }
  }

  return -1;
};

// Apply existing materials to the world
BOOL ApplyMaterials(BOOL bWorld, BOOL bFirstTime) {
  CIniConfig *piniApply = (bWorld ? &_iniWorld : &_iniGlobal);
  if (piniApply->IsEmpty()) return FALSE;

  // go through all brush polygons
  {FOREACHINSTATICARRAY(_pwoConfigWorld->wo_baBrushes.ba_apbpo, CBrushPolygon *, itbpo) {
    CBrushPolygon *pbpo = itbpo.Current();
    INDEX iMaterial = -1;
    INDEX iType = 0;
    BOOL bCanBeGlass = FALSE;

    const BOOL bTransparent = (pbpo->bpo_ulFlags & (BPOF_TRANSLUCENT|BPOF_TRANSPARENT));
    const BOOL bInvisible = (pbpo->bpo_ulFlags & BPOF_INVISIBLE);
    const BOOL bPortal = (pbpo->bpo_ulFlags & BPOF_PORTAL);
    const BOOL bShootThru = (pbpo->bpo_ulFlags & BPOF_SHOOTTHRU);
    const BOOL bPassable = (pbpo->bpo_ulFlags & BPOF_PASSABLE);

    // Skip if invisible
    if (bInvisible) continue;
    
    // Determine glass polygons
    if (bTransparent) {
      if (bFirstTime) {
        // Check if layers are opaque
        BOOL bOpaque = FALSE;
        for (INDEX iOpaqueLayer = 0; iOpaqueLayer < 3; iOpaqueLayer++) {
          bOpaque |= (pbpo->bpo_abptTextures[iOpaqueLayer].s.bpt_ubBlend == 0);
        }

        // Glass should not be opaque, shoot-through or passable
        bCanBeGlass = bTransparent && !bOpaque && !bShootThru && !bPassable;
      }

    // Skip if non-transparent portal
    } else if (bPortal) {
      continue;
    }

    // Skip if no textures
    BOOL bSkip = TRUE;

    for (INDEX iLayerCheck = 0; iLayerCheck < 3; iLayerCheck++) {
      CBrushPolygonTexture &bpt = pbpo->bpo_abptTextures[iLayerCheck];
      const CTFileName &fnCheckTex = bpt.bpt_toTexture.GetName();

      // At least one texture exists
      if (fnCheckTex != "") {
        bSkip = FALSE;
        break;
      }
    }

    if (bSkip) continue;

    const INDEX iSurfaceType = pbpo->bpo_bppProperties.bpp_ubSurfaceType;

    // Determine generic type from the surface
    switch (iSurfaceType) {
      // Leave certain surfaces as is if they've already been set
      case SURFACE_LAVA:
      case SURFACE_SAND:
      case SURFACE_WATER:
      case SURFACE_RED_SAND:
      case SURFACE_GRASS:
      case SURFACE_WOOD:
      case SURFACE_SNOW:
        continue;

      // Sliding
      case SURFACE_ICE:
      case SURFACE_ICE_CLIMBABLESLOPE:
      case SURFACE_ICE_SLIDINGSLOPE:
      case SURFACE_ICE_LESSSLIDING:
      case SURFACE_ICE_SLIDINGSLOPE_NOIMPACT:
      case SURFACE_GRASS_SLIDING:
        iType = 1;
        break;

      // No impact
      case SURFACE_STONE_NOIMPACT:
      case SURFACE_ROLLERCOASTER_NOIMPACT:
      case SURFACE_STONE_HIGHSTAIRS_NOIMPACT:
      case SURFACE_GRASS_NOIMPACT:
        iType = 2;
        break;

      // High slopes
      case SURFACE_CLIMBABLESLOPE:
        iType = 3;
        break;

      // New surfaces
      default: {
        if (iSurfaceType >= SURFACE_LAST_VANILLA) {
          // [material] - [the normal type of this material]
          // e.g. SUR_METAL_NOIMPACT - SUR_METAL_NORMAL
          INDEX iShifted = (iSurfaceType - SURFACE_LAST_VANILLA);
          iType = (iShifted - INDEX(iShifted / ESRT_LAST) * ESRT_LAST);
        }
      }
    }

    // for each texture on the polygon
    for (INDEX iLayer = 0; iLayer < 3; iLayer++) {
      // get the texture
      CBrushPolygonTexture &bpt = pbpo->bpo_abptTextures[iLayer];
      const CTFileName &fnTex = bpt.bpt_toTexture.GetName();

      if (fnTex == "") continue;

      INDEX iMaterialInTheList = FindTextureMaterial(*piniApply, fnTex);

      if (iMaterialInTheList != -1) {
        iMaterial = _aiMaterials[iMaterialInTheList];
        break;
      }
    }

    // Apply the material
    if (iMaterial >= SURFACE_LAST_VANILLA) {
      // Determine the material for new surfaces
      iMaterial += iType;

    } else {
      // Determine the material for old surfaces (leaves surface as is if the special type is 0, i.e. normal)
      switch (iMaterial) {
        case SURFACE_GRASS: {
          switch (iType) {
            // No "slope" variant
            case 1: iMaterial = SURFACE_GRASS_SLIDING; break;
            case 2: iMaterial = SURFACE_GRASS_NOIMPACT; break;
          }
        } break;

        case SURFACE_WOOD: {
          switch (iType) {
            // No "no impact" variant
            case 1: iMaterial = SURFACE_WOOD_SLIDING; break;
            case 3: iMaterial = SURFACE_WOOD_SLOPE; break;
          }
        } break;

        // Override with ice
        case SURFACE_SNOW: {
          switch (iType) {
            // No "no impact" or "slope" variants
            case 1: iMaterial = SURFACE_ICE; break;
          }
        } break;

        default:
          // Glass
          if (bCanBeGlass) {
            iMaterial = MATERIAL_VAR(GLASS) + iType;

          // Just stone
          } else {
            switch (iType) {
              case 1: iMaterial = SURFACE_ICE; break; // Ice
              case 2: iMaterial = SURFACE_STONE_NOIMPACT; break; // No impact
              case 3: iMaterial = SURFACE_CLIMBABLESLOPE; break; // High slope
            }
          }
          break;
      }
    }

    // Change the surface if found any material
    if (iMaterial != -1) {
      pbpo->bpo_bppProperties.bpp_ubSurfaceType = iMaterial;
    }
  }}

  return TRUE;
};

extern CBrushPolygon *_pbpoMaterial;

// Set material for this polygon
void SetMaterial(INDEX iLayer, INDEX iMat) {
  iLayer = Clamp(iLayer, (INDEX)0, (INDEX)2);
  iMat = Clamp(iMat, (INDEX)0, (INDEX)(_ctMaterials-1));

  // no polygon
  if (_pbpoMaterial == NULL) {
    CPrintF(" No polygon selected! (try '_bMaterialCheck = 1')\n");
    return;
  }

  // get the texture
  CBrushPolygonTexture &bpt = _pbpoMaterial->bpo_abptTextures[iLayer];
  const CTFileName &fnTex = bpt.bpt_toTexture.GetName();

  // no texture on the layer
  if (fnTex == "") {
    CPrintF(" No texture on layer %d!\n", iLayer);
    return;
  }

  const char *strMat = _astrMaterials[iMat];
  _piniCurrent->SetValue("Materials", fnTex.str_String, strMat);

  CPrintF(" Set %s material for '%s'\n", strMat, fnTex.str_String);
};

// Remove material from the list
void RemoveMaterial(INDEX iLayer) {
  // no polygon
  if (_pbpoMaterial == NULL) {
    CPrintF(" No polygon selected! (try '_bMaterialCheck = 1')\n");
    return;
  }

  // get the texture
  CBrushPolygonTexture &bpt = _pbpoMaterial->bpo_abptTextures[iLayer];
  const CTFileName &fnTex = bpt.bpt_toTexture.GetName();

  // no texture on the layer
  if (fnTex == "") {
    CPrintF(" No texture on layer %d!\n", iLayer);
    return;
  }

  // Check full path and then just the filename
  if (_piniCurrent->Delete("Materials", fnTex.str_String)
   || _piniCurrent->Delete("Materials", fnTex.FileName().str_String)) {
    CPrintF(" Material has been removed from '%s'!\n", fnTex.str_String);
  } else {
    CPrintF(" '%s' doesn't have a material set to it!\n", fnTex.str_String);
  }
};

// Help with functions
void MaterialsHelp(void) {
  CPutString("\n ^cffffff-- Materials help:\n\n");

  CPutString(" _bMaterialCheck - select polygon under the crosshair\n");
  CPutString(" SetMaterial(layer, material) - set material for a layer of the selected polygon\n");
  CPutString(" RemoveMaterial(layer) - remove material using a certain layer of the selected polygon\n");
  CPutString(" ResaveMaterials() - resave current materials config\n");
  CPutString(" SwitchMaterialConfig(level) - switch between global and level config (0 or 1)\n");

  CPutString("\n ^cffffff-- List of materials:\n\n");

  for (INDEX iMat = 0; iMat < _ctMaterials; iMat++) {
    CPrintF(" %d - %s\n", iMat, _astrMaterials[iMat]);
  }

  CPutString("\n");
};