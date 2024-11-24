105
%{
#include "StdH.h"
%}

%{

extern DECL_DLL void JumpFromBouncer(CEntity *penToBounce, CEntity *penBouncer)
{
  CEntity *pen = penToBounce;
  CBouncer *pbo = (CBouncer *)penBouncer;
  // if it is a movable model and some time has passed from the last jump
  if ( (pen->GetRenderType()==CEntity::RT_MODEL) &&
       (pen->GetPhysicsFlags()&EPF_MOVABLE) ) {
    CMovableEntity *pmen = (CMovableEntity *)pen;
    if (pmen->en_penReference==NULL) {
      return;
    }
    // give it speed
    FLOAT3D vDir;
    AnglesToDirectionVector(pbo->m_aDirection, vDir);

    // [Cecil] Adjust jump speed and control time
    FLOAT fSpeed = pbo->m_fSpeed * (GetSP()->sp_iHLGamemode == HLGM_FLYROCKET ? 0.5f : 1.0f);
    FLOAT fControl = pbo->m_tmControl * (GetSP()->sp_iHLGamemode == HLGM_FLYROCKET ? 2.0f : 1.0f);

    pmen->FakeJump(pmen->en_vIntendedTranslation, vDir, fSpeed, 
      -pbo->m_fParallelComponentMultiplier, pbo->m_fNormalComponentMultiplier, pbo->m_fMaxExitSpeed, fControl);
  }
}

%}

class CBouncer : CRationalEntity {
name      "Bouncer";
thumbnail "Thumbnails\\Bouncer.tbn";
features  "HasName";

properties:
  1 CTString m_strName            "Name" 'N' = "Bouncer",
  2 CTString m_strDescription = "",
  
  4 FLOAT m_fSpeed                "Speed [m/s]" 'S' = 20.0f,
  5 ANGLE3D m_aDirection          "Direction" 'D' = ANGLE3D(0,90,0),
  6 FLOAT m_tmControl             "Control time" 'T' = 5.0f,
  7 BOOL m_bEntrySpeed            = TRUE,
 10 FLOAT m_fMaxExitSpeed                 "Max exit speed" 'M' = 200.0f,
 12 FLOAT m_fNormalComponentMultiplier    "Normal component multiplier" 'O' = 1.0f,
 13 FLOAT m_fParallelComponentMultiplier  "Parallel component multiplier" 'P' = 0.0f,

{
  // [Cecil] Physics object
  SPhysObject m_obj;
}

components:

functions:
  // [Cecil] Constructor
  void CBouncer(void) {
    PhysObj().SetOwner(this);
  };

  // [Cecil] On destruction
  virtual void OnEnd(void) {
    PhysObj().Clear(TRUE);
    CRationalEntity::OnEnd();
  };

  // [Cecil] Get physics object
  odeObject &PhysObj(void) {
    return *m_obj.pObj;
  };

  // [Cecil] Create the ODE object
  void CreateObject(void) {
    // Delete last object
    PhysObj().Clear(TRUE);

    if (!ODE_IsStarted()) { return; }

    // Empty brush or hidden (destroyed)
    if (IsEmptyBrush() || (GetFlags() & ENF_HIDDEN)) { return; }

    // Begin creating a new object
    PhysObj().BeginShape(GetPlacement(), 1.0f, OBJF_BODY);
    PhysObj().SetCollision(OBJC_WORLD, OBJC_REGULAR);

    // Determine if the brush is flat to offset some polygons
    FLOATaabbox3D boxBrush;
    GetSize(boxBrush);
    FLOAT3D vBrushSize = boxBrush.Size();
    const BOOL bOffset = (vBrushSize(1) < 0.05f || vBrushSize(2) < 0.05f || vBrushSize(3) < 0.05f);

    // No vertices added
    if (!PhysObj().mesh.FromBrush(GetBrush(), NULL, FALSE, bOffset)) {
      return;
    }

    PhysObj().mesh.Build();
    PhysObj().SetTrimesh();

    PhysObj().EndShape();

    PhysObj().SetKinematic(TRUE);
    PhysObj().SetMaxRotationSpeed(dInfinity);

    // Add this object to the controller
    _penGlobalController->m_cKinematicEntities.Add(PhysObj().nPhysOwner);
  };

  // [Cecil] Make physics object follow the brush
  void OnPhysStep(void) {
    const FLOAT3D vCurrent = GetPlacement().pl_PositionVector;
    const FLOATmatrix3D mCurrent = GetRotationMatrix();

    // [Cecil] TEMP: Reset placement of physics objects with invalid positions
    if (!PhysObj().IsValidPosition()) {
      ODE_ReportOutOfBounds("ID:%u  ^cff7f7f%s entity at %s has invalid physics position!^C Resetting to the entity position...", en_ulID,
        GetClass()->ec_pdecDLLClass->dec_strName, ODE_PrintVectorForReport(GetPlacement().pl_PositionVector));

      PhysObj().SetPosition(vCurrent);
      PhysObj().SetMatrix(mCurrent);
    }

    // Move after the brush's position
    const FLOAT3D vDiff = (vCurrent - PhysObj().GetPosition());
    PhysObj().SetCurrentTranslation(vDiff / ONE_TICK);

    // Set rotation from the matrix difference in absolute coordinates
    ANGLE3D aDiff;
    DecomposeRotationMatrixNoSnap(aDiff, mCurrent * !PhysObj().GetMatrix());

    PhysObj().SetCurrentRotation(aDiff / ONE_TICK);
  };

procedures:
  Main() {
    // declare yourself as a brush
    InitAsBrush();
    SetPhysicsFlags(EPF_BRUSH_FIXED|EPF_NOIMPACT);
    SetCollisionFlags(ECF_BRUSH);

    // if old flag "entry speed" has been reset
    if (!m_bEntrySpeed)
    {
      // kill normal component by default (same behaviour by default)
      m_fNormalComponentMultiplier = 0.0f;
      m_bEntrySpeed = TRUE;
    }
    return;
  }
};
