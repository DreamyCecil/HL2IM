#include "StdAfx.h"

#include "Engine/Templates/Stock_CEntityClass.h"

// [Cecil] TODO: Remove dependency on the engine and add the source file to GameMP
#define DECL_DLL _declspec(dllimport)
#include "Bots/Patcher/patcher.h"
#undef DECL_DLL

// [Cecil] Original function pointer
typedef CEntity *(CWorld::*CCreateEntityFunc)(const CPlacement3D &, CEntityClass *);
static CCreateEntityFunc pCreateEntityFunc = NULL;

// [Cecil] World functions patch
class CWorldPatch : public CWorld {
  public:
    // [Cecil] Replace certain classes on creation
    CEntity *P_CreateEntity(const CPlacement3D &plPlacement, CEntityClass *pecClass) {
      // Skip to the original function if not in game
      if (_bWorldEditorApp && !GetSP()->sp_bQuickTest) {
        return (this->*pCreateEntityFunc)(plPlacement, pecClass);
      }

      // Get class filename of the requested entity class
      CTFileName fnmClass = pecClass->GetName();

      // Class replacement macro
      #define CLASS_REPLACE(_OldClass, _NewClass) \
        if (fnmClass == CTString("Classes\\" _OldClass ".ecl")) \
          fnmClass = CTFILENAME("Classes\\" _NewClass ".ecl")

      // Beta 0.7 enemies
      if (GetSP()->sp_iHL2Flags & HL2F_ENEMIES1)
      {
             CLASS_REPLACE("Boneman",       "BetaEnemies\\Antlion");
        else CLASS_REPLACE("Werebull",      "BetaEnemies\\AntlionGuard");
        else CLASS_REPLACE("Guffy",         "BetaEnemies\\CombineElite");
        else CLASS_REPLACE("Grunt",         "BetaEnemies\\CombineSoldier");
        else CLASS_REPLACE("ChainSawFreak", "BetaEnemies\\FastZombie");
        else CLASS_REPLACE("Gizmo",         "BetaEnemies\\Headcrab");
        else CLASS_REPLACE("Eyeman",        "BetaEnemies\\Manhack");
        else CLASS_REPLACE("Summoner",      "BetaEnemies\\Merasmus");
        else CLASS_REPLACE("Headman",       "BetaEnemies\\Metrocop");
      }

      // Obtain a replacement entity class
      CEntityClass *pecReplacement = _pEntityClassStock->Obtain_t(fnmClass);

      // Create entity from the new class
      CEntity *penNew = (this->*pCreateEntityFunc)(plPlacement, pecReplacement);

      // Release the replaced class
      _pEntityClassStock->Release(pecReplacement);

      return penNew;
    };
};

// [Cecil] World patches
extern void InitWorldPatches(void) {
  pCreateEntityFunc = &CWorld::CreateEntity;
	CPatch *pPatchCreate = new CPatch(pCreateEntityFunc, &CWorldPatch::P_CreateEntity, true, true);
};
