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
#include "WorldPatch.h"

// Define the patcher
#include <XGizmo/Patcher/patcher.h>
#include <XGizmo/Patcher/patcher.cpp>

#include <Engine/Templates/Stock_CEntityClass.h>

#include <EntitiesMP/Mod/PhysBase.h>

// Original function pointers
typedef CEntity *(CWorld::*CCreateEntityFunc)(const CPlacement3D &, CEntityClass *);
static CCreateEntityFunc pCreateEntityFunc = NULL;

typedef void (CEntity::*CFindSectorsFunc)(void);
static CFindSectorsFunc pFindSectorsFunc = NULL;

// World functions patch
class CWorldPatch : public CWorld {
  public:
    // Replace certain classes on creation
    CEntity *P_CreateEntity(const CPlacement3D &plPlacement, CEntityClass *pecClass) {
      // Skip to the original function if not in game
      if (!IsPlayingGame()) {
        return (this->*pCreateEntityFunc)(plPlacement, pecClass);
      }

      // Get class filename of the requested entity class
      CTFileName fnmClass = pecClass->GetName();

      // Class replacement macro
      #define CLASS_REPLACE(_OldClass, _NewClass) \
        if (fnmClass == CTString("Classes\\" _OldClass ".ecl")) \
          fnmClass = CTFILENAME("Classes\\" _NewClass ".ecl")

      const BOOL bBeta = !!(GetSP()->sp_iHL2Flags & HL2F_ENEMIES1);
      const BOOL bNew  = !!(GetSP()->sp_iHL2Flags & HL2F_ENEMIES2);

      // Beta 0.7 enemies
      if (bBeta) {
             CLASS_REPLACE("Boneman",       "BetaEnemies\\Antlion");
        else CLASS_REPLACE("Werebull",      "BetaEnemies\\AntlionGuard");
        else CLASS_REPLACE("Guffy",         "BetaEnemies\\CombineElite");
        else CLASS_REPLACE("Grunt",         "BetaEnemies\\CombineSoldier");
        else CLASS_REPLACE("ChainSawFreak", "BetaEnemies\\FastZombie");
        else CLASS_REPLACE("Gizmo",         "BetaEnemies\\Headcrab");
        else CLASS_REPLACE("Eyeman",        "BetaEnemies\\Manhack");
        else CLASS_REPLACE("Summoner",      "BetaEnemies\\Merasmus");
        else CLASS_REPLACE("Headman",       "BetaEnemies\\Metrocop");

      // Half-Life 2 enemies
      } else if (bNew) {
        NOTHING;
      }

      // New enemies overall
      if (bBeta || bNew) {
        CLASS_REPLACE("BigHead", "Enemies\\ScientistSKA");
      }

      // Obtain a replacement entity class
      CEntityClass *pecReplacement = _pEntityClassStock->Obtain_t(fnmClass);

      // Create entity from the new class
      CEntity *penNew = (this->*pCreateEntityFunc)(plPlacement, pecReplacement);

      // Release the replacement class
      _pEntityClassStock->Release(pecReplacement);

      return penNew;
    };
};

// Entity functions patch
class CEntityPatch : public CEntity {
  public:
    void P_FindSectorsAroundEntityNear(void) {
      // [Cecil] TEMP: Search for sectors as precisely as possible in order to not skip anything
      // This is currently only relevant for CPhysBase entities but this check is much faster and
      // in line with the check inside CCecilMovableEntity::TestFields() that skips invalid sectors
      if (GetPhysicsFlags() & EPF_CUSTOMCOLLISION) {
        FindSectorsAroundEntity();
        return;
      }

      // Proceed to the original function
      (this->*pFindSectorsFunc)();
    };
};

// Initialize function patches on game start
void InitWorldPatches(void) {
  pCreateEntityFunc = &CWorld::CreateEntity;
  CPatch *pPatchCreate = new CPatch(pCreateEntityFunc, &CWorldPatch::P_CreateEntity, true, true);

  ASSERT(pPatchCreate->IsValid() && pPatchCreate->IsPatched());

  pFindSectorsFunc = &CEntity::FindSectorsAroundEntityNear;
  CPatch *pPatchFindSectors = new CPatch(pFindSectorsFunc, &CEntityPatch::P_FindSectorsAroundEntityNear, true, true);

  ASSERT(pPatchFindSectors->IsValid() && pPatchFindSectors->IsPatched());
};
