5004
%{
#include "StdH.h"

#include "EntitiesMP/Cecil/Weapons.h"

// [Cecil] World conversion
#include "EntitiesMP/WorldBase.h"

// Pointer to this entity
extern CEntity *_penGlobalController = NULL;

#define SERVER_REPORT(_Message) if (_pNetwork->IsServer()) CPrintF("[REPORT]: %s\n", _Message)
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

    OnLevelStart();
  };

  // Count memory used by this object
  SLONG GetUsedMemory(void) {
    SLONG slUsedMemory = sizeof(CGlobalController) - sizeof(CRationalEntity) + CRationalEntity::GetUsedMemory();
    return slUsedMemory;
  };

  // Update the level according to session options
  void UpdateLevel(void) {
    // get the first world base
    CWorldBase *penBase = NULL;

    {FOREACHINDYNAMICCONTAINER(GetWorld()->wo_cenEntities, CEntity, iten) {
      CEntity *pen = iten;

      if (!IsOfClassID(pen, CWorldBase_ClassID)) {
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

  // Perform actions at the start of a new level
  void OnLevelStart(void) {
    UpdateLevel();
  };

procedures:
  MainLoop() {
    while (TRUE)
    {
      wait (_pTimer->TickQuantum) {
        on (EPreLevelChange) : {
          resume;
        }

        on (EPostLevelChange) : {
          OnLevelStart();
          resume;
        }

        on (ETimer) : { stop; }
        otherwise() : { resume; }
      }
    }

    return;
  };

  Main() {
    InitAsVoid();
    SetPhysicsFlags(EPF_MODEL_IMMATERIAL);
    SetCollisionFlags(ECF_IMMATERIAL);

    // Travel between levels
    SetFlags(GetFlags() | ENF_CROSSESLEVELS | ENF_NOTIFYLEVELCHANGE);

    autowait(_pTimer->TickQuantum);

    OnLevelStart();
    jump MainLoop();
  };
};
