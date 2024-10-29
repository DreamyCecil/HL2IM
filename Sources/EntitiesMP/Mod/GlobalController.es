5004
%{
#include "StdH.h"

#include "EntitiesMP/Cecil/Weapons.h"
#include "EntitiesMP/Mod/PhysBase.h"

// [Cecil] World conversion
#include "EntitiesMP/WorldBase.h"

// Pointer to this entity
CGlobalController *_penGlobalController = NULL;

#define SERVER_REPORT(_Message) if (_pNetwork->IsServer()) CPrintF("[REPORT]: %s\n", _Message)

extern CPhysEngine *_pODE;
%}

class export CGlobalController : CRationalEntity {
name      "GlobalController";
thumbnail "";
features  "IsImportant";

properties:
{
  // Physics objects to call step functions for
  CEntityReferences m_cPhysStep;
}

components:
  1 model MODEL_MARKER "Models\\Editor\\Axis.mdl",

functions:
  // Constructor
  void CGlobalController(void) {
    // set pointer to this entity
    _penGlobalController = this;
  };

  // [Cecil] NOTE: Don't care about what or how things are being written or read
  // because this entity is created right after loading the world on server start
  void Write_t(CTStream *ostr) {
    CRationalEntity::Write_t(ostr);

    _pODE->WriteState_t(ostr, FALSE);

    // Write physics objects
    *ostr << m_cPhysStep.GetNodes().Count();

    FOREACHNODEINREFS(m_cPhysStep, itn) {
      *ostr << itn->GetOwner()->en_ulID;
    }
  };

  void Read_t(CTStream *istr) {
    CRationalEntity::Read_t(istr);

    OnLevelStart(FALSE);

    _pODE->ReadState_t(istr);

    // Read physics objects and reference them
    INDEX ct;
    *istr >> ct;

    for (INDEX i = 0; i < ct; i++) {
      ULONG ulID;
      *istr >> ulID;

      CPhysBase *pen = (CPhysBase *)GetWorld()->EntityFromID(ulID);
      m_cPhysStep.Add(pen->m_nNode);
    }
  };

  // Count memory used by this object
  SLONG GetUsedMemory(void) {
    SLONG slUsedMemory = sizeof(CGlobalController) - sizeof(CRationalEntity) + CRationalEntity::GetUsedMemory();
    return slUsedMemory;
  };

  void RenderParticles(void) {
    // [Cecil] TEMP: Render boxes around brush physics objects
    FOREACHNODEINREFS(m_cPhysStep, itn) {
      CPhysBase *pen = (CPhysBase *)itn->GetOwner();

      if (pen->GetRenderType() != RT_BRUSH) {
        continue;
      }

      pen->RenderParticles();
    }
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

      penBase = (CWorldBase *)pen;
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
  void OnLevelStart(BOOL bFreshStart) {
    UpdateLevel();

    // Start physics
    if (bFreshStart) {
      ODE_Start();
    }
  };

procedures:
  MainLoop() {
    while (TRUE)
    {
      wait (ONE_TICK) {
        on (EPreLevelChange) : {
          // Stop physics
          ODE_End();
          resume;
        }

        on (EPostLevelChange) : {
          OnLevelStart(TRUE);
          resume;
        }

        // Toggle physics
        on (EStart) : { ODE_Start(); resume; }
        on (EStop) : { ODE_End(); resume; }

        on (ETimer) : { stop; }
        otherwise() : { resume; }
      }

      // Execute step function for physics objects
      FOREACHNODEINREFS(m_cPhysStep, itn) {
        CPhysBase *pen = (CPhysBase *)itn->GetOwner();
        pen->OnPhysStep();
      }

      ODE_DoSimulation(GetWorld());
    }

    return;
  };

  Main() {
    // [Cecil] TEMP: Initialize as a model to allow rendering of particles
    //InitAsVoid();
    InitAsEditorModel();
    SetModel(MODEL_MARKER);

    SetPhysicsFlags(EPF_MODEL_IMMATERIAL);
    SetCollisionFlags(ECF_IMMATERIAL);

    // Travel between levels
    SetFlags(GetFlags() | ENF_CROSSESLEVELS | ENF_NOTIFYLEVELCHANGE);

    autowait(ONE_TICK);

    OnLevelStart(TRUE);
    jump MainLoop();
  };
};
