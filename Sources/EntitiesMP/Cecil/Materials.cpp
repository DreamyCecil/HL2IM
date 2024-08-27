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

// Compatibility
extern void (*_pJSON_PrintFunction)(const char *);
extern std::string (*_pJSON_LoadConfigFile)(std::string);

std::string LoadConfigFile(std::string strFile) {
  CTFileStream strm;
  strm.Open_t(CTString(strFile.c_str()));

  // read until the end
  CTString strConfig = "";
  strConfig.ReadUntilEOF_t(strm);
  strm.Close();

  // return config
  return strConfig.str_String;
};

void HookFunctions(void) {
  _pJSON_PrintFunction = (void (*)(const char *))CPrintF;
  _pJSON_LoadConfigFile = (std::string (*)(std::string))LoadConfigFile;
};

// Loaded materials
static CConfigBlock _cbGlobal;
static CConfigBlock _cbWorld;
static CConfigBlock *_pcbCurrentConfig = NULL;

static CWorld *_pwoConfigWorld = NULL;
static CTFileName _fnCurrentConfig = CTString("Scripts\\GlobalMaterials.json");

// Save and load materials of the world
BOOL LoadMaterials(CWorld *pwo) {
  // Unload current materials if they're still loaded
  if (_pcbCurrentConfig != NULL && _pcbCurrentConfig->Count() > 0) {
    UnloadMaterials();
  }

  HookFunctions();

  _pwoConfigWorld = pwo;
  const CTFileName fnWorld = CTString("Scripts\\LevelMaterials\\" + pwo->wo_fnmFileName.FileName()+".json");
  const CTFileName fnGlobal = CTString("Scripts\\GlobalMaterials.json");

  // load the config
  if (ParseConfig(fnWorld, _cbWorld)) {
    _fnCurrentConfig = fnWorld;
    _pcbCurrentConfig = &_cbWorld;

    // apply global materials if needed
    int iLoad = 0;
    if (_cbWorld.GetValue("LoadGlobal", iLoad) && iLoad)
    {
      if (ParseConfig(fnGlobal, _cbGlobal)) {
        _pcbCurrentConfig = &_cbGlobal;
        _fnCurrentConfig = fnGlobal;

      } else {
        CPrintF(" Couldn't load global config, only using world config.\n");
      }
    }

  // load global config instead
  } else if (ParseConfig(fnGlobal, _cbGlobal)) {
    CPrintF(" Couldn't load world config, using global config instead.\n");
    _fnCurrentConfig = fnGlobal;
    _pcbCurrentConfig = &_cbGlobal;

  // delete if couldn't load
  } else {
    CPrintF(" Couldn't load any materials!\n (neither world config, nor 'GlobalMaterials.json')\n");
    _cbGlobal.Clear();
    _cbWorld.Clear();
  }

  return TRUE;
};

void UnloadMaterials(void) {
  if (_pcbCurrentConfig == NULL) {
    return;
  }

  _cbGlobal.Clear();
  _cbWorld.Clear();

  _pcbCurrentConfig = NULL;
  _pwoConfigWorld = NULL;
  _fnCurrentConfig = CTString("Scripts\\GlobalMaterials.json");
};

void SaveMaterials(void) {
  if (_pcbCurrentConfig->Count() <= 0) {
    CPrintF(" Materials aren't loaded!\n");
    return;
  }

  try {
    std::string strMaterials = "";
    _pcbCurrentConfig->Print(strMaterials);

    CTString strSave = strMaterials.c_str();
    strSave.Save_t(_fnCurrentConfig);

    CPrintF(" Resaved config into '%s'\n", _fnCurrentConfig);
  } catch (char *strError) {
    CPrintF("%s\n", strError);
  }
};

// Switch between material configs
void SwitchMaterialConfig(INDEX iConfig) {
  HookFunctions();

  switch (iConfig) {
    // level config
    case 1:
      _fnCurrentConfig = CTString("Scripts\\LevelMaterials\\" + _pwoConfigWorld->wo_fnmFileName.FileName()+".json");
      _pcbCurrentConfig = &_cbWorld;

      // load level config
      if (ParseConfig(_fnCurrentConfig, _cbWorld)) {
        CPrintF(" Switched to level config (%s)\n", _fnCurrentConfig.FileName());

      // just create a new one if couldn't load
      } else {
        CPrintF(" Couldn't load level config, creating a new one! (%s)\n", _fnCurrentConfig);

        // mark it to use global config
        int iDummy = 0;
        if (!_pcbCurrentConfig->GetValue("LoadGlobal", iDummy)) {
          _pcbCurrentConfig->AddValue("LoadGlobal", (INDEX)1);
        }
      }
      break;

    // global config
    default:
      _fnCurrentConfig = CTString("Scripts\\GlobalMaterials.json");
      _pcbCurrentConfig = &_cbGlobal;

      // load global config
      if (ParseConfig(_fnCurrentConfig, _cbGlobal)) {
        CPrintF(" Switched to global config (GlobalMaterials.json)\n");

      // just create a new one if couldn't load
      } else {
        CPrintF(" Couldn't load global config, creating a new one! (Scripts\\GlobalMaterials.json)\n");
      }
  }
};

// Relevant materials and their names
const char *_astrMaterials[] = {
  "STONE", "SAND", "WATER", "RED_SAND", "GRASS", "WOOD", "SNOW", "METAL", "METAL_GRATE", "CHAINLINK", "TILES", "GLASS",
};

INDEX _aiMaterials[] = {
  SURFACE_STONE, SURFACE_SAND, SURFACE_WATER, SURFACE_RED_SAND, SURFACE_GRASS, SURFACE_WOOD, SURFACE_SNOW,
  MATERIAL_VAR(METAL), MATERIAL_VAR(METAL_GRATE), MATERIAL_VAR(CHAINLINK), MATERIAL_VAR(TILES), MATERIAL_VAR(GLASS),
};

const INDEX _ctMaterials = 12;

// Find position of the texture in a specific material
INDEX FindMaterialTexture(CConfigBlock *pcb, const CTFileName &fnTex, const CTString &strMaterial) {
  if (strMaterial == "" || fnTex == "") {
    return -1;
  }

  // get the array of this material
  CConfigArray *caArray;
  if (!pcb->GetValue(strMaterial.str_String, caArray)) {
    return -1;
  }

  INDEX ctTextures = caArray->Count();

  // no textures for that material
  if (ctTextures <= 0) {
    return -1;
  }

  // find the texture
  for (INDEX iTex = 0; iTex < ctTextures; iTex++) {
    CConfigValue &cv = (*caArray)[iTex];

    // found the texture
    if (fnTex == cv.cv_strValue) {
      return iTex;
    }
  }

  return -1;
};

// Find position and material of a specific texture
INDEX TextureMaterialExists(CConfigBlock *pcb, const CTFileName &fnTex, INDEX &iMaterial) {
  // go through all the materials (skip stone - 0)
  for (INDEX i = 1; i < _ctMaterials; i++) {
    INDEX iTex = FindMaterialTexture(pcb, fnTex, _astrMaterials[i]);

    if (iTex != -1) {
      iMaterial = i;
      return iTex;
    }
  }

  return -1;
};

// Apply existing materials to the world
BOOL ApplyMaterials(BOOL bWorld, BOOL bFirstTime) {
  CConfigBlock *pcbApply = (bWorld ? &_cbWorld : &_cbGlobal);

  if (pcbApply->Count() <= 0) {
    return FALSE;
  }

  // go through all brush polygons
  {FOREACHINSTATICARRAY(_pwoConfigWorld->wo_baBrushes.ba_apbpo, CBrushPolygon *, itbpo) {
    CBrushPolygon *pbpo = itbpo.Current();
    // [Cecil] TEMP: Don't set the stone
    INDEX iMaterial = -1; //(bFirstTime ? SURFACE_STONE : -1);
    INDEX iType = 0;
    BOOL bCanBeGlass = FALSE;

    // skip if no textures
    BOOL bSkip = TRUE;

    for (INDEX iLayerCheck = 0; iLayerCheck < 3; iLayerCheck++) {
      CBrushPolygonTexture &bpt = pbpo->bpo_abptTextures[iLayerCheck];
      CTString fnCheckTex = bpt.bpt_toTexture.GetName().FileName().str_String;

      // at least one texture exists
      if (fnCheckTex != "") {
        bSkip = FALSE;
        break;
      }
    }

    // skip if invisible
    if (!bSkip) {
      BOOL bTransparent = (pbpo->bpo_ulFlags & (BPOF_TRANSLUCENT|BPOF_TRANSPARENT));
      BOOL bInvisible = (pbpo->bpo_ulFlags & BPOF_INVISIBLE);
      BOOL bPortal = (pbpo->bpo_ulFlags & BPOF_PORTAL);
      BOOL bShootThru = (pbpo->bpo_ulFlags & BPOF_SHOOTTHRU);
      BOOL bPassable = (pbpo->bpo_ulFlags & BPOF_PASSABLE);

      if (bTransparent) {
        // skip if invisible
        bSkip = bInvisible;

        // determine glass polygons
        if (!bSkip && bFirstTime)
        {
          // check if layers are opaque
          BOOL bOpaque = FALSE;
          for (INDEX iOpaqueLayer = 0; iOpaqueLayer < 3; iOpaqueLayer++) {
            bOpaque |= (pbpo->bpo_abptTextures[iOpaqueLayer].s.bpt_ubBlend == 0);
          }

          // glass should not be opaque, shoot-through or passable
          bCanBeGlass = bTransparent && !bOpaque && !bShootThru && !bPassable;
        }

      // skip if invisible in any way
      } else {
        bSkip = (bPortal || bInvisible);
      }
    }

    // skip this polygon
    if (bSkip) {
      continue;
    }

    // get the type
    INDEX iPolygonType = pbpo->bpo_bppProperties.bpp_ubSurfaceType;
    switch (iPolygonType) {
      // sliding
      case 1: case 4: case 5: case 6: case 14: case 19:
        iType = 1;
        break;

      // no impact
      case 11: case 15: case 16: case 20:
        iType = 2;
        break;

      // high slopes
      case 10:
        iType = 3;
        break;

      // new surfaces
      default: {
        if (iPolygonType >= SURFACE_LAST) {
          // [material] - [the normal type of this material]
          // e.g. SUR_METAL_NOIMPACT - SUR_METAL_NORMAL
          INDEX iShifted = (iPolygonType - SURFACE_LAST);
          iType = (iShifted - INDEX(floor(iShifted / ESRT_LAST))*ESRT_LAST);
        }
      }
    }

    // reset the material
    if (bFirstTime) {
      // [Cecil] TEMP 2: Don't reset at all

      // [Cecil] TEMP: Don't reset specific surfaces
      /*if (iPolygonType != SURFACE_WATER
       && iPolygonType != SURFACE_WOOD) {
        pbpo->bpo_bppProperties.bpp_ubSurfaceType = 0;
      }*/
    }

    // for each texture on the polygon
    for (INDEX iLayer = 0; iLayer < 3; iLayer++) {
      // get the texture
      CBrushPolygonTexture &bpt = pbpo->bpo_abptTextures[iLayer];
      CTString fnTex = bpt.bpt_toTexture.GetName().FileName().str_String;

      if (fnTex == "") {
        continue;
      }

      INDEX iMaterialInTheList = 0;

      if (TextureMaterialExists(pcbApply, fnTex, iMaterialInTheList) != -1) {
        iMaterial = _aiMaterials[iMaterialInTheList];
        break;
      }
    }

    // apply the material
    if (iMaterial >= SURFACE_LAST) {
      // determine the material for new surfaces
      iMaterial += iType;

    } else {
      // determine the material for old surfaces
      switch (iMaterial) {
        case SURFACE_GRASS:
          switch (iType) {
            case 1: iMaterial = SURFACE_GRASS_SLIDING; break;
            case 2: iMaterial = SURFACE_GRASS_NOIMPACT; break;
          }
          break;

        case SURFACE_WOOD:
          switch (iType) {
            case 1: iMaterial = SURFACE_WOOD_SLIDING; break;
            case 3: iMaterial = SURFACE_WOOD_SLOPE; break;
          }
          break;

        // override with ice
        case SURFACE_SNOW:
          switch (iType) {
            case 1: iMaterial = 1; break;
          }
          break;

        default:
          // glass
          if (bCanBeGlass) {
            iMaterial = MATERIAL_VAR(GLASS) + iType;

          // just stone
          } else {
            switch (iType) {
              case 1: iMaterial = 1; break; // ice
              case 2: iMaterial = 11; break; // no impact
              case 3: iMaterial = 10; break; // high slope
            }
          }
          break;
      }
    }

    // if found any material
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
  const char *strMat = _astrMaterials[iMat];

  // no polygon
  if (_pbpoMaterial == NULL) {
    CPrintF(" No polygon selected! (try '_bMaterialCheck = 1')\n");
    return;
  }

  // get the texture
  CBrushPolygonTexture &bpt = _pbpoMaterial->bpo_abptTextures[iLayer];
  CTString fnTex = bpt.bpt_toTexture.GetName().FileName().str_String;

  // no texture on the layer
  if (fnTex == "") {
    CPrintF(" No texture on layer %d!\n", iLayer);
    return;
  }

  CConfigArray *caArray;

  // create the needed material
  if (!_pcbCurrentConfig->GetValue(strMat, caArray)) {
    caArray = new CConfigArray();
    _pcbCurrentConfig->AddValue(strMat, caArray);
    CPrintF(" Created '%s' material\n", strMat);
  }

  CConfigArray *caMaterial = caArray;

  // remove texture from the other material
  INDEX iDeleteFromMat = 0;
  INDEX iTex = TextureMaterialExists(_pcbCurrentConfig, fnTex, iDeleteFromMat);

  // try to find the texture first
  if (iTex != -1) {
    // same material
    if (iDeleteFromMat == iMat) {
      CPrintF(" '%s' material was already assigned to this texture!\n", strMat);
      return;
    }

    // delete it
    _pcbCurrentConfig->GetValue(_astrMaterials[iDeleteFromMat], caArray);
    caArray->Delete(iTex);
    CPrintF(" Texture was removed from material '%s'\n", _astrMaterials[iDeleteFromMat]);
  }

  // add this texture to materials
  std::string strPrint = "";
  caMaterial->AddValue(fnTex.str_String);
  caMaterial->Print(strPrint, 0);

  CPrintF("'%s' : %s\n\n Changed material for '%s'\n", strMat, strPrint.c_str(), fnTex);
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
  CTString fnTex = bpt.bpt_toTexture.GetName().FileName().str_String;

  // no texture on the layer
  if (fnTex == "") {
    CPrintF(" No texture on layer %d!\n", iLayer);
    return;
  }

  CConfigArray *caArray;

  // remove texture from the material
  INDEX iDeleteFromMat = 0;
  INDEX iTex = TextureMaterialExists(_pcbCurrentConfig, fnTex, iDeleteFromMat);

  // try to find the texture first
  if (iTex != -1) {
    // delete it
    _pcbCurrentConfig->GetValue(_astrMaterials[iDeleteFromMat], caArray);
    caArray->Delete(iTex);
    CPrintF(" Texture was removed from material '%s'\n", _astrMaterials[iDeleteFromMat]);

  } else {
    CPrintF(" Material for this texture doesn't exist!\n");
    return;
  }
};

// Help with functions
void MaterialsHelp(void) {
  CPrintF("\n ^cffffff-- Materials help:\n\n");

  CPrintF(" _bMaterialCheck - select polygon under the crosshair\n");
  CPrintF(" SetMaterial(layer, material) - set material for a layer of the selected polygon\n");
  CPrintF(" RemoveMaterial(layer) - remove material using a certain layer of the selected polygon\n");
  CPrintF(" ResaveMaterials() - resave current materials config\n");
  CPrintF(" SwitchMaterialConfig(level) - switch between global and level config (0 or 1)\n");

  CPrintF("\n ^cffffff-- List of materials:\n\n");

  for (INDEX iMat = 0; iMat < _ctMaterials; iMat++) {
    CPrintF(" %d - %s\n", iMat, _astrMaterials[iMat]);
  }

  CPrintF("\n");
};