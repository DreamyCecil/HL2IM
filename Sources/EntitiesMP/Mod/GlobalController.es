5004
%{
#include "StdH.h"

#include "EntitiesMP/Cecil/Weapons.h"
#include "EntitiesMP/Mod/PhysBase.h"

#include "EntitiesMP/Bouncer.h"
#include "EntitiesMP/MovingBrush.h"
#include "EntitiesMP/WorldBase.h"

// Pointer to this entity
CGlobalController *_penGlobalController = NULL;

#define SERVER_REPORT(_Message) if (_pNetwork->IsServer()) CPrintF("[REPORT]: %s\n", _Message)

extern CPhysEngine *_pODE;

// [Cecil] TEMP
extern INDEX ode_bRenderPosition;
extern void Particles_ColoredBox(const CPlacement3D &plCenter, const FLOAT3D &vSize, COLOR col);
%}

class export CGlobalController : CRationalEntity {
name      "GlobalController";
thumbnail "";
features  "IsImportant";

properties:
  1 FLOAT m_tmLevelStart = 0.0f,

{
  // Physics objects that currently exist in the world
  CEntityReferences m_cPhysEntities;

  // Kinematic objects that currently exist in the world
  CEntityReferences m_cKinematicEntities;
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
    *ostr << m_cPhysEntities.GetNodes().Count();

    FOREACHNODEINREFS(m_cPhysEntities, itnP) {
      *ostr << itnP->GetOwner()->en_ulID;
    }

    *ostr << m_cKinematicEntities.GetNodes().Count();

    FOREACHNODEINREFS(m_cKinematicEntities, itnK) {
      *ostr << itnK->GetOwner()->en_ulID;
    }
  };

  void Read_t(CTStream *istr) {
    CRationalEntity::Read_t(istr);

    OnLevelStart(FALSE);

    _pODE->ReadState_t(istr);

    // Read physics objects and reference them
    INDEX i, ct;
    *istr >> ct;

    for (i = 0; i < ct; i++) {
      ULONG ulID;
      *istr >> ulID;

      odeObject *pObj = SPhysObject::ForEntity(GetWorld()->EntityFromID(ulID));
      ASSERT(pObj != NULL);

      m_cPhysEntities.Add(pObj->nPhysOwner);
    }

    *istr >> ct;

    for (i = 0; i < ct; i++) {
      ULONG ulID;
      *istr >> ulID;

      odeObject *pObj = SPhysObject::ForEntity(GetWorld()->EntityFromID(ulID));
      ASSERT(pObj != NULL);

      m_cKinematicEntities.Add(pObj->nPhysOwner);
    }
  };

  // Count memory used by this object
  SLONG GetUsedMemory(void) {
    SLONG slUsedMemory = sizeof(CGlobalController) - sizeof(CRationalEntity) + CRationalEntity::GetUsedMemory();
    return slUsedMemory;
  };

  void RenderParticles(void) {
    // [Cecil] TEMP: Render boxes around brush physics objects
    FOREACHNODEINREFS(m_cPhysEntities, itnP) {
      CPhysBase *pen = (CPhysBase *)itnP->GetOwner();

      if (pen->GetRenderType() != RT_BRUSH) {
        continue;
      }

      pen->RenderParticles();
    }

    // [Cecil] TEMP: Render boxes around kinematic objects
    if (ode_bRenderPosition && (!_pNetwork->IsNetworkEnabled() || _pNetwork->IsServer())) {
      FOREACHNODEINREFS(m_cKinematicEntities, itnK) {
        CEntity *pen = itnK->GetOwner();
        odeObject *pObj = SPhysObject::ForEntity(pen);

        if (pObj == NULL) {
          continue;
        }

        FLOATaabbox3D box = DOUBLEtoFLOAT(pObj->mesh.boxVolume);
        FLOAT3D vSize = box.Size() + FLOAT3D(0.01f, 0.01f, 0.01f);

        CPlacement3D plPhys(pObj->GetPosition() + box.Center() * pObj->GetMatrix(), ANGLE3D(0, 0, 0));
        DecomposeRotationMatrixNoSnap(plPhys.pl_OrientationAngle, pObj->GetMatrix());

        Particles_ColoredBox(plPhys, vSize, C_GREEN|0x3F); // Real physics object position
      }
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

    if (bFreshStart) {
      // Remember level start time
      m_tmLevelStart = _pTimer->CurrentTick();

      // Start physics
      if (GetSP()->sp_iPhysFlags & PHYSF_ENABLE) {
        ODE_Start();
      }
    }
  };

  // Global rendering method
  void RenderOnScreen(CDrawPort *pdp) {
    const PIX pixW = pdp->GetWidth();
    const PIX pixH = pdp->GetHeight();

    // Display the funny
    if (_pTimer->GetLerpedCurrentTick() - m_tmLevelStart < 2.0f) {
      pdp->SetFont(_pfdDisplayFont);
      pdp->SetTextAspect(1.0f);
      pdp->SetTextScaling(pixH / 640.0f); // 640 instead of 480 to make text smaller
      pdp->PutTextCXY("Node Graph out of Date. Rebuilding...", pixW * 0.5f, pixH * (1.0f / 3.0f), 0xFFFFFFFF);
    }
  };

  // Check if the entity is physical
  BOOL IsPhysical(CEntity *pen) {
    return m_cPhysEntities.IsReferenced(pen);
  };

  // Check if the entity is kinematic
  BOOL IsKinematic(CEntity *pen) {
    return m_cKinematicEntities.IsReferenced(pen);
  };

  // Find physics objects in some area
  void FindPhysObjects(const FLOATaabbox3D &box, CDynamicContainer<class CPhysBase> &cOutput) {
    CDynamicContainer<CEntity> cenInRange;
    FindEntitiesInRange(box, cenInRange, FALSE);

    FOREACHINDYNAMICCONTAINER(cenInRange, CEntity, iten) {
      CEntity *pen = iten;

      // Only add entities referenced in the list
      if (m_cPhysEntities.IsReferenced(pen)) {
        cOutput.Add((CPhysBase *)pen);
      }
    }
  };

  // Update physics objects in some area by unfreezing them
  void UpdatePhysObjects(const FLOATaabbox3D &box) {
    CDynamicContainer<CPhysBase> cObjects;
    _penGlobalController->FindPhysObjects(box, cObjects);

    FOREACHINDYNAMICCONTAINER(cObjects, CPhysBase, iten) {
      iten->PhysObj().Unfreeze();
    }
  };

procedures:
  MainLoop() {
    while (TRUE)
    {
      wait (ONE_TICK) {
        on (EPreLevelChange) : {
          // Stop physics
          ODE_End(TRUE);
          resume;
        }

        on (EPostLevelChange) : {
          OnLevelStart(TRUE);
          resume;
        }

        // Toggle physics
        on (EStart) : { ODE_Start(); resume; }
        on (EStop) : { ODE_End(FALSE); resume; }

        on (ETimer) : { stop; }
        otherwise() : { resume; }
      }

      // Execute step function for physics objects
      FOREACHNODEINREFS(m_cPhysEntities, itnP) {
        CPhysBase *pen = (CPhysBase *)itnP->GetOwner();
        pen->OnPhysStep();
      }

      FOREACHNODEINREFS(m_cKinematicEntities, itnK) {
        CEntity *pen = itnK->GetOwner();

        if (IsOfClassID(pen, CMovingBrush_ClassID)) {
          ((CMovingBrush *)pen)->OnPhysStep();

        } else if (IsOfClassID(pen, CBouncer_ClassID)) {
          ((CBouncer *)pen)->OnPhysStep();
        }
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
