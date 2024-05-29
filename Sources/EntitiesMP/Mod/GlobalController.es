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

      if (!IsOfClass(pen, "WorldBase")) {
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
