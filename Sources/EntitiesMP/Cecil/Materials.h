// ***** [Cecil] This header is for Material functions only! ***** //

#include <Engine/Base/Memory.h>

#ifdef _DEBUG
  #undef new
#endif

#include "EntitiesMP/Cecil/DreamyJSON/DreamyJSON.h"

#ifdef _DEBUG
  #define new DEBUG_NEW_CT
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
enum ENUM_##Type##_SURFACE_LIST { \
  SUR_##Type##_NORMAL   = SURFACE_LAST + Offset*ESRT_LAST + 0, \
  SUR_##Type##_SLIDING  = SURFACE_LAST + Offset*ESRT_LAST + 1, \
  SUR_##Type##_NOIMPACT = SURFACE_LAST + Offset*ESRT_LAST + 2, \
  SUR_##Type##_SLOPE    = SURFACE_LAST + Offset*ESRT_LAST + 3, \
}

// Check for the material in a switch-case block
#define MATERIAL_CASES(Type) \
     SUR_##Type##_NORMAL:   \
case SUR_##Type##_SLIDING:  \
case SUR_##Type##_NOIMPACT: \
case SUR_##Type##_SLOPE

#define MATERIAL_VAR(Type) SUR_##Type##_NORMAL

// Print material names (should be the same)
#define MATERIAL_NAMES(Name) Name, Name, Name, Name

// New surfaces
#define CT_NEW_SURFACES 5
NEW_SURFACE(METAL,       0);
NEW_SURFACE(METAL_GRATE, 1);
NEW_SURFACE(CHAINLINK,   2);
NEW_SURFACE(TILES,       3);
NEW_SURFACE(GLASS,       4);

// Load and resave materials of the world
BOOL LoadMaterials(CWorld *pwo);
void SaveMaterials(void);
void UnloadMaterials(void);
// Switch between material configs
void SwitchMaterialConfig(INDEX iConfig);

// Find position of the texture in a specific material
INDEX FindMaterialTexture(CConfigBlock *pcb, string fnTex, string strMaterial);
// Find position and material of a specific texture
INDEX TextureMaterialExists(CConfigBlock *pcb, string fnTex, INDEX &iMaterial);
// Apply existing materials to the world
BOOL ApplyMaterials(BOOL bWorld, BOOL bFirstTime);

// Set material for this polygon
void SetMaterial(INDEX iLayer, INDEX iMat);
// Remove material from the list
void RemoveMaterial(INDEX iLayer);

// Help with functions
void MaterialsHelp(void);