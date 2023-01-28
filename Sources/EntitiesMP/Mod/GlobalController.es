5004
%{
#include "StdH.h"

#include "EntitiesMP/Cecil/Materials.h"
#include "EntitiesMP/Cecil/Weapons.h"

// [Cecil] World conversion
#include "EntitiesMP/PlayerWeapons.h"
#include "EntitiesMP/WorldBase.h"

#include "EntitiesMP/Camera.h"
#include "EntitiesMP/EnemyBase.h"
#include "EntitiesMP/EnemySpawner.h"
#include "EntitiesMP/Lightning.h"
#include "EntitiesMP/MovingBrush.h"
#include "EntitiesMP/PyramidSpaceShip.h"
#include "EntitiesMP/StormController.h"

#include "EntitiesMP/KeyItem.h"
#include "EntitiesMP/DoorController.h"
#include "EntitiesMP/PlayerMarker.h"

// Pointer to this entity
extern CEntity *_penGlobalController = NULL;

#define SERVER_REPORT(_Message) if (_pNetwork->IsServer()) CPrintF("[REPORT]: %s\n", _Message)

// [Cecil] Convert TFE weapon flags into TSE flags
static void ConvertWeapon(INDEX &iFlags, const INDEX &iWeapon) {
  switch (iWeapon) {
    // Laser
    case 14:
      iFlags |= WeaponFlag(WEAPON_LASER);
      //iFlags &= ~WeaponFlag(14);
      break;

    // Cannon
    case 16:
      iFlags |= WeaponFlag(WEAPON_RPG);
      //iFlags &= ~WeaponFlag(16);
      break;

    // non-existent weapons
    case 10: case 12: case 15: case 17:
    case WEAPON_FLAMER: case WEAPON_CROSSBOW:
      //iFlags &= ~WeaponFlag(iWeapon);
      break;

    default: iFlags |= WeaponFlag(iWeapon);
  }
};
%}

class export CGlobalController : CRationalEntity {
name      "GlobalController";
thumbnail "";
features  "IsImportant";

properties:

components:

functions:
  // Constructor
  void CGlobalController(void) {
    // set pointer to this entity
    _penGlobalController = this;
  };

  void Read_t(CTStream *istr) {
    CRationalEntity::Read_t(istr);

    // [Cecil] Update the level
    UpdateLevel();
  };

  // Count memory used by this object
  SLONG GetUsedMemory(void) {
    SLONG slUsedMemory = sizeof(CGlobalController) - sizeof(CRationalEntity) + CRationalEntity::GetUsedMemory();
    return slUsedMemory;
  };

  // [Cecil] Update the level according to session options
  void UpdateLevel(void) {
    // get the first world base
    CWorldBase *penBase = NULL;

    {FOREACHINDYNAMICCONTAINER(GetWorld()->wo_cenEntities, CEntity, iten) {
      CEntity *pen = iten;

      if (!IsOfDllClass(pen, CWorldBase_DLLClass)) {
        continue;
      }

      penBase = (CWorldBase*)pen;
      break;
    }}

    // no world base
    if (penBase == NULL) {
      SERVER_REPORT("Material loading failed - Unable to find the first WorldBase!");
      return;
    }

    const INDEX iFlags = GetSP()->sp_iHL2Flags;

    // apply materials
    if (iFlags & HL2F_MATERIALS) {
      // mark as loaded
      if (!penBase->m_bMaterials) {
        penBase->m_bMaterials = TRUE;

        // create materials
        if (LoadMaterials(GetWorld())) {
          // set global materials first
          BOOL bGlobalSet = ApplyMaterials(FALSE, TRUE);
          // count as first init if global materials haven't been set
          ApplyMaterials(TRUE, !bGlobalSet);
        }
      }
    }

    // mark as reinitialized
    if (penBase->m_bReinit) {
      return;
    }

    penBase->m_bReinit = TRUE;

    // Convert world
    if (iFlags & HL2F_REINITMAP) {
      INDEX iReinit = 0;
      SERVER_REPORT("Converting TFE level into TSE level...");

      {FOREACHINDYNAMICCONTAINER(GetWorld()->wo_cenEntities, CEntity, iten) {
        CEntity *pen = iten;

        // [Cecil] Check for the entities that NEED to be updated rather than the ones that don't
        if (!IsDerivedFromDllClass(pen, CEnemyBase_DLLClass)
         && !IsOfDllClass(pen, CCamera_DLLClass)
         && !IsOfDllClass(pen, CEnemySpawner_DLLClass)
         && !IsOfDllClass(pen, CLightning_DLLClass)
         && !IsOfDllClass(pen, CMovingBrush_DLLClass)
         && !IsOfDllClass(pen, CPyramidSpaceShip_DLLClass)
         && !IsOfDllClass(pen, CStormController_DLLClass)
         && !IsOfDllClass(pen, CKeyItem_DLLClass)
         && !IsOfDllClass(pen, CDoorController_DLLClass)
         && !IsOfDllClass(pen, CPlayerMarker_DLLClass)) {
          continue;
        }

        if (IsOfDllClass(pen, CPlayerMarker_DLLClass)) {
          CPlayerMarker *penWeapons = (CPlayerMarker *)pen;
          INDEX *piWeapons = &penWeapons->m_iGiveWeapons;
          INDEX *piTakeWeapons = &penWeapons->m_iTakeWeapons;
          INDEX iNewWeapons = 0x03;
          INDEX iNewTakeWeapons = 0;

          for (INDEX iGetWeapon = 1; iGetWeapon < 18; iGetWeapon++) {
            // replace the weapon if we have it
            if (WeaponExists(*piWeapons, iGetWeapon)) {
              ConvertWeapon(iNewWeapons, iGetWeapon);
            }

            if (WeaponExists(*piTakeWeapons, iGetWeapon)) {
              ConvertWeapon(iNewTakeWeapons, iGetWeapon);
            }
          }

          *piWeapons = iNewWeapons;
          *piTakeWeapons = iNewTakeWeapons;
          SERVER_REPORT("- Converted PlayerMarker");

        } else if (IsOfDllClass(pen, CKeyItem_DLLClass)) {
          CKeyItem *penKey = (CKeyItem *)pen;

          switch (penKey->m_kitType) {
            // Dummy keys
            case 4: penKey->m_kitType = KIT_JAGUARGOLDDUMMY; break;
            case 15: penKey->m_kitType = KIT_TABLESDUMMY; break;

            // Element keys
            case 5: penKey->m_kitType = KIT_CROSSWOODEN; break;
            case 6: penKey->m_kitType = KIT_CROSSMETAL; break;
            case 7: penKey->m_kitType = KIT_CRYSTALSKULL; break;
            case 8: penKey->m_kitType = KIT_CROSSGOLD; break;

            // Other keys
            default: penKey->m_kitType = KIT_KINGSTATUE; break;
          }

          penKey->Reinitialize();
          SERVER_REPORT("- Converted KeyItem");
          iReinit++;

        } else if (IsOfDllClass(pen, CDoorController_DLLClass)) {
          CDoorController *penDoor = (CDoorController *)pen;

          switch (penDoor->m_kitKey) {
            // Dummy keys
            case 4: penDoor->m_kitKey = KIT_JAGUARGOLDDUMMY; break;
            case 15: penDoor->m_kitKey = KIT_TABLESDUMMY; break;

            // Element keys
            case 5: penDoor->m_kitKey = KIT_CROSSWOODEN; break;
            case 6: penDoor->m_kitKey = KIT_CROSSMETAL; break;
            case 7: penDoor->m_kitKey = KIT_CRYSTALSKULL; break;
            case 8: penDoor->m_kitKey = KIT_CROSSGOLD; break;

            // Other keys
            default: penDoor->m_kitKey = KIT_KINGSTATUE; break;
          }

          penDoor->Reinitialize();
          SERVER_REPORT("- Converted DoorController");
          iReinit++;

        } else {
          pen->Reinitialize();
          iReinit++;
        }
      }}

      SERVER_REPORT(CTString(0, " - Reinitialized %d entities. Conversion end -", iReinit));
    }
  };

procedures:
  Main() {
    InitAsVoid();
    SetPhysicsFlags(EPF_MODEL_IMMATERIAL);
    SetCollisionFlags(ECF_IMMATERIAL);

    // travel between levels
    SetFlags(GetFlags()|ENF_CROSSESLEVELS|ENF_NOTIFYLEVELCHANGE);

    autowait(0.05f);

    wait() {
      on (EBegin) : {
        // [Cecil] Update the level
        UpdateLevel();
        resume;
      }

      on (EPreLevelChange) : {
        resume;
      }

      on (EPostLevelChange) : {
        // [Cecil] Update the level
        UpdateLevel();
        resume;
      }

      otherwise() : { resume; }
    }

    return;
  };
};
