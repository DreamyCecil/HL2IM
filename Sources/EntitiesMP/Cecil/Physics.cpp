#include "StdH.h"
#include "Physics.h"
#include "EntitiesMP/PlayerWeapons.h"

static FLOAT3D _vHandle;
static CBrushPolygon *_pbpoNear;
static FLOAT _fNearDistance;
static FLOAT3D _vNearPoint;
static FLOATplane3D _plPlane;

class CActiveSector {
public:
  CBrushSector *as_pbsc;
};

static CStaticStackArray<CActiveSector> _aas;

static void AddSector(CBrushSector *pbsc) {
  // if not already active and in first mip of its brush
  if (pbsc->bsc_pbmBrushMip->IsFirstMip() && !(pbsc->bsc_ulFlags & BSCF_NEARTESTED)) {
    // add it to active sectors
    _aas.Push().as_pbsc = pbsc;
    pbsc->bsc_ulFlags |= BSCF_NEARTESTED;
  }
};

static void AddAllSectorsOfBrush(CBrush3D *pbr) {
  // get first mip
  CBrushMip *pbmMip = pbr->GetFirstMip();

  // skip if it has no brush mip for that mip factor
  if (pbmMip == NULL) {
    return;
  }

  // for each sector in the brush mip
  FOREACHINDYNAMICARRAY(pbmMip->bm_abscSectors, CBrushSector, itbsc) {
    // add the sector
    AddSector(itbsc);
  }
};

// [Cecil] GetNearestPolygon() but with portal polygons
void SearchThroughSectors_Portal(void) {
  // for each active sector (sectors are added during iteration!)
  for (INDEX ias = 0; ias < _aas.Count(); ias++) {
    CBrushSector *pbsc = _aas[ias].as_pbsc;

    // for each polygon in the sector
    {FOREACHINSTATICARRAY(pbsc->bsc_abpoPolygons, CBrushPolygon, itbpo) {
      CBrushPolygon &bpo = *itbpo;

      // find distance of the polygon plane from the handle
      const FLOATplane3D &plPolygon = bpo.bpo_pbplPlane->bpl_plAbsolute;
      FLOAT fDistance = plPolygon.PointDistance(_vHandle);

      // skip if it is behind the plane or further than nearest found
      if (fDistance < 0.0f || fDistance > _fNearDistance) {
        continue;
      }

      // find projection of handle to the polygon plane
      FLOAT3D vOnPlane = plPolygon.ProjectPoint(_vHandle);

      // skip if it is not in the bounding box of polygon
      const FLOATaabbox3D &boxPolygon = bpo.bpo_boxBoundingBox;
      const FLOAT EPSILON = 0.01f;
      if ((boxPolygon.Min()(1) - EPSILON>vOnPlane(1))
       || (boxPolygon.Max()(1) + EPSILON<vOnPlane(1))
       || (boxPolygon.Min()(2) - EPSILON>vOnPlane(2))
       || (boxPolygon.Max()(2) + EPSILON<vOnPlane(2))
       || (boxPolygon.Min()(3) - EPSILON>vOnPlane(3))
       || (boxPolygon.Max()(3) + EPSILON<vOnPlane(3))) {
        continue;
      }

      // find major axes of the polygon plane
      INDEX iMajorAxis1, iMajorAxis2;
      GetMajorAxesForPlane(plPolygon, iMajorAxis1, iMajorAxis2);

      // create an intersector
      CIntersector isIntersector(_vHandle(iMajorAxis1), _vHandle(iMajorAxis2));
      // for all edges in the polygon
      FOREACHINSTATICARRAY(bpo.bpo_abpePolygonEdges, CBrushPolygonEdge, itbpePolygonEdge) {
        // get edge vertices (edge direction is irrelevant here!)
        const FLOAT3D &vVertex0 = itbpePolygonEdge->bpe_pbedEdge->bed_pbvxVertex0->bvx_vAbsolute;
        const FLOAT3D &vVertex1 = itbpePolygonEdge->bpe_pbedEdge->bed_pbvxVertex1->bvx_vAbsolute;
        // pass the edge to the intersector
        isIntersector.AddEdge(
          vVertex0(iMajorAxis1), vVertex0(iMajorAxis2),
          vVertex1(iMajorAxis1), vVertex1(iMajorAxis2));
      }

      // skip if the point is not inside polygon
      if (!isIntersector.IsIntersecting()) {
        continue;
      }

      // remember the polygon
      _pbpoNear = &bpo;
      _fNearDistance = fDistance;
      _vNearPoint = vOnPlane;
    }}

    // for each entity in the sector
    {FOREACHDSTOFSRC(pbsc->bsc_rsEntities, CEntity, en_rdSectors, pen)
      // if it is a brush
      if (pen->en_RenderType == CEntity::RT_BRUSH) {
        // get its brush
        CBrush3D &brBrush = *pen->en_pbrBrush;
        // add all sectors in the brush
        AddAllSectorsOfBrush(&brBrush);
      }
    ENDFOR}
  }
};

CBrushPolygon *GetNearestPolygon_Portal(CEntity *pen, FLOAT3D &vPoint, FLOATplane3D &plPlane, FLOAT &fDistanceToEdge) {
  // take reference point at handle of the model entity
  _vHandle = pen->en_plPlacement.pl_PositionVector;

  // start infinitely far away
  _pbpoNear = NULL;
  _fNearDistance = UpperLimit(1.0f);

  // for each zoning sector that this entity is in
  {FOREACHSRCOFDST(pen->en_rdSectors, CBrushSector, bsc_rsEntities, pbsc)
    // add the sector
    AddSector(pbsc);
  ENDFOR}

  // start the search
  SearchThroughSectors_Portal();

  // mark each sector as inactive
  for (INDEX ias = 0; ias < _aas.Count(); ias++) {
    _aas[ias].as_pbsc->bsc_ulFlags &= ~BSCF_NEARTESTED;
  }
  _aas.PopAll();

  // if there is some polygon found
  if (_pbpoNear != NULL) {
    // return info
    plPlane = _pbpoNear->bpo_pbplPlane->bpl_plAbsolute;
    vPoint = _vNearPoint;
    fDistanceToEdge = _pbpoNear->GetDistanceFromEdges(_vNearPoint);
    return _pbpoNear;
  }
  return NULL;
};

// [Cecil] Start holding an entity with the gravity gun
void GravityGunStart(CMovableEntity *pen, CEntity *penHolder) {
  // unhold this object from other players
  for (INDEX iPlayer = 0; iPlayer < CECIL_GetMaxPlayers(); iPlayer++) {
    CEntity *penPlayer = CECIL_GetPlayerEntity(iPlayer);

    if (penPlayer == NULL || penPlayer->GetFlags() & ENF_DELETED) {
      continue;
    }

    // skip the holder
    if (penPlayer == penHolder) {
      continue;
    }

    CPlayerWeapons *penWeapons = ((CPlayer*)penPlayer)->GetPlayerWeapons();

    // same object
    if (penWeapons->m_penHolding == pen) {
      //penWeapons->StopHolding();

      EGravityGunStop eStop;
      eStop.ulFlags = 0;
      penWeapons->SendEvent(eStop);
    }
  }

  // notify the holder that they can hold
  EGravityGunStart eStart;
  eStart.penTarget = pen;

  CPlayerWeapons *penWeapons = ((CPlayer*)penHolder)->GetPlayerWeapons();
  penWeapons->SendEvent(eStart);
};

// [Cecil] Stop holding an entity with the gravity gun
void GravityGunStop(CMovableEntity *pen, const EGravityGunStop &eStop) {
  ULONG ulFlags = eStop.ulFlags;
  //ULONG ulCollision = eStop.ulCollision;

  pen->SetPhysicsFlags(ulFlags);
  //pen->SetCollisionFlags(ulCollision);

  pen->SetDesiredTranslation(FLOAT3D(0.0f, 0.0f, 0.0f));
  pen->SetDesiredRotation(ANGLE3D(0.0f, 0.0f, 0.0f));
};

// [Cecil] Entity is being held by the gravity gun
void GravityGunHolding(CMovableEntity *pen, const EGravityGunHold &eHold) {
  CPlacement3D plPos = CPlacement3D(eHold.vPos, eHold.aRot);
  ULONG ulFlags = eHold.ulFlags;
  //ULONG ulCollision = eHold.ulCollision;

  const BOOL bItem = IsDerivedFromClass(pen, "Item");

  pen->SetPhysicsFlags(ulFlags);
  //pen->SetCollisionFlags(ulCollision);

  FLOAT3D vDiff = (plPos.pl_PositionVector - pen->GetPlacement().pl_PositionVector);
  const FLOAT fDiff = vDiff.Length();

  // Collect items
  if (bItem && fDiff < 1.0f) {
    EPass ePass;
    ePass.penOther = ((CPlayerWeapons&)*eHold.penHolder).m_penPlayer;
    pen->SendEvent(ePass);
    pen->ForceFullStop();
  }

  if (fDiff > 0.0f) {
    // slower speed
    if (fDiff > 4.0f) {
      pen->SetDesiredTranslation(vDiff / _pTimer->TickQuantum * 0.5f);
    } else {
      pen->SetDesiredTranslation(vDiff / _pTimer->TickQuantum);
    }
  } else {
    pen->SetDesiredTranslation(FLOAT3D(0.0f, 0.0f, 0.0f));
  }

  // Too far
  if (fDiff > 12.0f) {
    //StopHolding();
    //ProngsAnim(FALSE, FALSE);

    CEntity *penHolder = eHold.penHolder;

    EGravityGunStop eStop;
    eStop.ulFlags = 1;
    penHolder->SendEvent(eStop);
    return;
  }

  if (!bItem && !IsOfClass(pen, "Radio")) {
    return;
  }

  // Angle difference
  ANGLE3D aObject = pen->GetPlacement().pl_OrientationAngle;
  ANGLE3D aAngle = ANGLE3D(plPos.pl_OrientationAngle(1), 0.0f, 0.0f) - aObject;

  // Normalize angles
  aAngle(1) = Clamp(NormalizeAngle(aAngle(1)), -70.0f, 70.0f);
  aAngle(2) = Clamp(NormalizeAngle(aAngle(2)), -70.0f, 70.0f);
  aAngle(3) = Clamp(NormalizeAngle(aAngle(3)), -70.0f, 70.0f);

  // Rotate
  pen->SetDesiredRotation(aAngle / _pTimer->TickQuantum);
};

// [Cecil] Push the object with the gravity gun
void GravityGunPush(CMovableEntity *pen, FLOAT3D vDir) {
  pen->GiveImpulseTranslationAbsolute(vDir);
};

// [Cecil] Ported MovableEntity functions

// add acceleration to velocity
static inline void AddAcceleration(FLOAT3D &vCurrentVelocity, const FLOAT3D &vDesiredVelocity, FLOAT fAcceleration, FLOAT fDecceleration) {
  // if desired velocity is smaller than current velocity
  if (vDesiredVelocity.Length() < vCurrentVelocity.Length()) {
    fAcceleration = fDecceleration;
  }
  // find difference between current and desired velocities
  FLOAT3D vDelta = vDesiredVelocity-vCurrentVelocity;
  // accelerate in the direction of the difference with given maximum acceleration
  FLOAT fDelta = vDelta.Length();
  if (fDelta > fAcceleration) {
    vCurrentVelocity += vDelta*(fAcceleration/fDelta);
  } else {
    vCurrentVelocity = vDesiredVelocity;
  }
};

// add gravity acceleration to velocity along an axis
static inline void AddGAcceleration(FLOAT3D &vCurrentVelocity, const FLOAT3D &vGDir, FLOAT fGA, FLOAT fGV) {
  // disassemble speed
  FLOAT3D vCurrentParallel, vCurrentOrthogonal;
  GetParallelAndNormalComponents(vCurrentVelocity, vGDir, vCurrentOrthogonal, vCurrentParallel);

  if (_pNetwork->ga_ulDemoMinorVersion <= 2) {
    Swap(vCurrentOrthogonal, vCurrentParallel);
  }

  FLOAT3D vCurrentOrthogonalOrg = vCurrentOrthogonal;
  // add accelleration to parallel speed
  vCurrentOrthogonal += vGDir*fGA;

  // if going down at max speed
  if (vCurrentOrthogonal % vGDir >= fGV) {
    // clamp
    vCurrentOrthogonal = vGDir*fGV;
  } else {
    vCurrentOrthogonalOrg = vCurrentOrthogonal;
  }

  if (_pNetwork->ga_ulDemoMinorVersion>2) {
    vCurrentOrthogonal = vCurrentOrthogonalOrg;
  }

  // assemble speed back
  vCurrentVelocity = vCurrentParallel+vCurrentOrthogonal;
};

// NOTE:
// this is pulled out into a separate function because, otherwise, VC6 generates
// invalid code when optimizing this. no clue why is that so.
#pragma inline_depth(0)
static void CheckAndAddGAcceleration(CMovableEntity *pen, FLOAT3D &vTranslationAbsolute, FLOAT fTickQuantum) {
  // if there is forcefield involved
  if (pen->en_fForceA > 0.01f) {
    // add force acceleration
    FLOAT fGV = pen->en_fForceV * fTickQuantum;
    FLOAT fGA = pen->en_fForceA * fTickQuantum * fTickQuantum;
    AddGAcceleration(vTranslationAbsolute, pen->en_vForceDir, fGA, fGV);
  }
};
#pragma inline_depth()  // see important note above

// add acceleration to velocity, but only along a plane
static inline void AddAccelerationOnPlane(FLOAT3D &vCurrentVelocity, const FLOAT3D &vDesiredVelocity, FLOAT fAcceleration, FLOAT fDecceleration, const FLOAT3D &vPlaneNormal) {
  FLOAT3D vCurrentParallel, vCurrentOrthogonal;
  GetParallelAndNormalComponents(vCurrentVelocity, vPlaneNormal, vCurrentOrthogonal, vCurrentParallel);
  FLOAT3D vDesiredParallel;
  GetNormalComponent(vDesiredVelocity, vPlaneNormal, vDesiredParallel);
  AddAcceleration(vCurrentParallel, vDesiredParallel, fAcceleration, fDecceleration);
  vCurrentVelocity = vCurrentParallel + vCurrentOrthogonal;
};

// add acceleration to velocity, for roller-coaster slope -- slow!
static inline void AddAccelerationOnPlane2(FLOAT3D &vCurrentVelocity, const FLOAT3D &vDesiredVelocity,
                                           FLOAT fAcceleration, FLOAT fDecceleration, const FLOAT3D &vPlaneNormal, const FLOAT3D &vGravity) {
  // get down and horizontal direction
  FLOAT3D vDn;
  GetNormalComponent(vGravity, vPlaneNormal, vDn);
  vDn.Normalize();
  FLOAT3D vRt = vPlaneNormal*vDn;
  vRt.Normalize();

  // add only horizontal acceleration
  FLOAT3D vCurrentParallel, vCurrentOrthogonal;
  GetParallelAndNormalComponents(vCurrentVelocity, vRt, vCurrentParallel, vCurrentOrthogonal);
  FLOAT3D vDesiredParallel;
  GetParallelComponent(vDesiredVelocity, vRt, vDesiredParallel);
  AddAcceleration(vCurrentParallel, vDesiredParallel, fAcceleration, fDecceleration);
  vCurrentVelocity = vCurrentParallel + vCurrentOrthogonal;
};

// [Cecil] PreMoving() with rotate-to-plane flag
void Cecil_PreMoving(CMovableEntity *pen, FLOAT3D &vRotationDir) {
  if (pen->en_pciCollisionInfo == NULL) {
    return;
  }

  // remember old placement for lerping
  pen->en_plLastPlacement = pen->en_plPlacement;

  // for each child of the mover
  {FOREACHINLIST(CEntity, en_lnInParent, pen->en_lhChildren, itenChild) {
    // if the child is movable, yet not in movers list
    if ((itenChild->en_ulPhysicsFlags&EPF_MOVABLE)
      &&!((CMovableEntity*)&*itenChild)->en_lnInMovers.IsLinked()) {
      CMovableEntity *penChild = ((CMovableEntity*)&*itenChild);
      // remember old placement for lerping
      penChild->en_plLastPlacement = penChild->en_plPlacement;  
    }
  }}

  FLOAT fTickQuantum = _pTimer->TickQuantum; // used for normalizing from SI units to game ticks

  // NOTE: this limits maximum velocity of any entity in game.
  // it is absolutely neccessary in order to prevent extreme slowdowns in physics.
  // if you plan to increase this one radically, consider decreasing 
  // collision grid cell size!
  // currently limited to a bit less than speed of sound (not that it is any specificaly
  // relevant constant, but it is just handy)
  const FLOAT fMaxSpeed = 300.0f;
  pen->en_vCurrentTranslationAbsolute(1) = Clamp(pen->en_vCurrentTranslationAbsolute(1), -fMaxSpeed, +fMaxSpeed);
  pen->en_vCurrentTranslationAbsolute(2) = Clamp(pen->en_vCurrentTranslationAbsolute(2), -fMaxSpeed, +fMaxSpeed);
  pen->en_vCurrentTranslationAbsolute(3) = Clamp(pen->en_vCurrentTranslationAbsolute(3), -fMaxSpeed, +fMaxSpeed);

  // if the entity is a model
  if (pen->en_RenderType == CEntity::RT_MODEL || pen->en_RenderType == CEntity::RT_EDITORMODEL ||
      pen->en_RenderType == CEntity::RT_SKAMODEL || pen->en_RenderType == CEntity::RT_SKAEDITORMODEL) {
    // test for field containment
    pen->TestFields(pen->en_iUpContent, pen->en_iDnContent, pen->en_fImmersionFactor);

    // [Cecil] Rotate the entity towards the plane below it
    if (pen->en_ulPhysicsFlags & EPF_ROTATETOPLANE)
    {
      const FLOAT fMaxDist = 2.0f;
      // cast the ray towards the gravity direction
      CCastRay crBelow(pen, pen->en_plPlacement.pl_PositionVector, pen->en_plPlacement.pl_PositionVector + pen->en_vGravityDir*fMaxDist);
      crBelow.cr_ttHitModels = CCastRay::TT_NONE;
      crBelow.cr_bHitTranslucentPortals = FALSE;
      pen->GetWorld()->CastRay(crBelow);

      // if hit a brush polygon
      if (crBelow.cr_penHit != NULL && crBelow.cr_pbpoBrushPolygon != NULL) {
        // calculate angles
        FLOAT3D vNewDir = -(FLOAT3D&)crBelow.cr_pbpoBrushPolygon->bpo_pbplPlane->bpl_plAbsolute;
        ANGLE3D aCur, aDes;
        DirectionVectorToAngles(vRotationDir, aCur);
        DirectionVectorToAngles(vNewDir, aDes);
        // find angle difference
        aDes -= aCur;
        aDes(1) = NormalizeAngle(aDes(1));
        aDes(2) = NormalizeAngle(aDes(2));
        aDes(3) = NormalizeAngle(aDes(3));
        // if the difference is not that big
        if (Abs(aDes(2)) < 45 && Abs(aDes(3)) < 45) {
          // set the plane vector
          vRotationDir = vNewDir;
        }
      } else {
        // reset rotation direction
        vRotationDir = pen->en_vGravityDir;
      }
    } else {
      vRotationDir = pen->en_vGravityDir;
    }

    // if entity has sticky feet
    if (pen->en_ulPhysicsFlags & EPF_STICKYFEET) {
      // find gravity towards nearest polygon
      FLOAT3D vPoint;
      FLOATplane3D plPlane;
      FLOAT fDistanceToEdge;

      // [Cecil] Check for portals too
      if (GetNearestPolygon_Portal(pen, vPoint, plPlane, fDistanceToEdge)) {
        pen->en_vGravityDir = -(FLOAT3D&)plPlane;
        vRotationDir = -(FLOAT3D&)plPlane; // [Cecil]
      }
    }
  }

  CContentType &ctDn = pen->en_pwoWorld->wo_actContentTypes[pen->en_iDnContent];
  CContentType &ctUp = pen->en_pwoWorld->wo_actContentTypes[pen->en_iUpContent];

  // test entity breathing
  pen->TestBreathing(ctUp);
  // test content damage
  pen->TestContentDamage(ctDn, pen->en_fImmersionFactor);

  // test surface damage
  if (pen->en_penReference != NULL) {
    CSurfaceType &stReference = pen->en_pwoWorld->wo_astSurfaceTypes[pen->en_iReferenceSurface];
    pen->TestSurfaceDamage(stReference);
  }
   
  // calculate content fluid factors
  FLOAT fBouyancy = (1-
    (ctDn.ct_fDensity/pen->en_fDensity)*pen->en_fImmersionFactor-
    (ctUp.ct_fDensity/pen->en_fDensity)*(1-pen->en_fImmersionFactor));
  FLOAT fSpeedModifier = 
    ctDn.ct_fSpeedMultiplier*pen->en_fImmersionFactor+
    ctUp.ct_fSpeedMultiplier*(1-pen->en_fImmersionFactor);
  FLOAT fFluidFriction =
    ctDn.ct_fFluidFriction*pen->en_fImmersionFactor+
    ctUp.ct_fFluidFriction*(1-pen->en_fImmersionFactor);
  FLOAT fControlMultiplier =
    ctDn.ct_fControlMultiplier*pen->en_fImmersionFactor+
    ctUp.ct_fControlMultiplier*(1-pen->en_fImmersionFactor);

  // transform relative desired translation into absolute
  FLOAT3D vDesiredTranslationAbsolute = pen->en_vDesiredTranslationRelative;

  // relative absolute
  if (!(pen->en_ulPhysicsFlags & EPF_ABSOLUTETRANSLATE)) {
    vDesiredTranslationAbsolute *= pen->en_mRotation;
  }

  // transform translation and rotation into tick time units
  vDesiredTranslationAbsolute*=fTickQuantum;
  ANGLE3D aRotationRelative;
  aRotationRelative(1) = pen->en_aDesiredRotationRelative(1)*fTickQuantum;
  aRotationRelative(2) = pen->en_aDesiredRotationRelative(2)*fTickQuantum;
  aRotationRelative(3) = pen->en_aDesiredRotationRelative(3)*fTickQuantum;
  // make absolute matrix rotation from relative angle rotation
  FLOATmatrix3D mRotationAbsolute;

  if ((pen->en_ulPhysicsFlags & EPF_ONBLOCK_MASK) == EPF_ONBLOCK_PUSH) {
    FLOATmatrix3D mNewRotation;
    MakeRotationMatrixFast(mNewRotation, pen->en_plPlacement.pl_OrientationAngle+aRotationRelative);
    mRotationAbsolute = mNewRotation*!pen->en_mRotation;

  } else {
    MakeRotationMatrixFast(mRotationAbsolute, aRotationRelative);
    mRotationAbsolute = pen->en_mRotation*(mRotationAbsolute*!pen->en_mRotation);
  }

  // modify desired speed for fluid parameters
  vDesiredTranslationAbsolute*=fSpeedModifier;

  // remember jumping strength (if any)
  FLOAT fJump = -pen->en_mRotation.GetColumn(2)%vDesiredTranslationAbsolute;

  BOOL bReferenceMovingInY = FALSE;
  BOOL bReferenceRotatingNonY = FALSE;
  // if we have a CMovableEntity for a reference entity
  if (pen->en_penReference!=NULL && (pen->en_penReference->en_ulPhysicsFlags&EPF_MOVABLE)) {
    CMovableEntity *penReference = (CMovableEntity *)(CEntity*)pen->en_penReference;
    // get reference deltas for this tick
    const FLOAT3D &vReferenceTranslation = penReference->en_vIntendedTranslation;
    const FLOATmatrix3D &mReferenceRotation = penReference->en_mIntendedRotation;
    // calculate radius of this entity relative to reference
    FLOAT3D vRadius = pen->en_plPlacement.pl_PositionVector
        -penReference->en_plPlacement.pl_PositionVector;
    FLOAT3D vReferenceDelta = vReferenceTranslation + vRadius*mReferenceRotation - vRadius;
    // add the deltas to this entity
    vDesiredTranslationAbsolute += vReferenceDelta;
    mRotationAbsolute = mReferenceRotation*mRotationAbsolute;

    // remember if reference is moving in y
    bReferenceMovingInY = (vReferenceDelta%pen->en_vGravityDir != 0.0f);
    bReferenceRotatingNonY = ((pen->en_vGravityDir*mReferenceRotation)%pen->en_vGravityDir)>0.01f;
  }

  FLOAT3D vTranslationAbsolute = pen->en_vCurrentTranslationAbsolute*fTickQuantum;

  // initially not orienting
  pen->en_ulPhysicsFlags &= ~EPF_ORIENTINGTOGRAVITY;

  // if the entity is rotated by gravity
  if (pen->en_ulPhysicsFlags & EPF_ORIENTEDBYGRAVITY) {
    // find entity's down vector
    FLOAT3D vDown;
    vDown(1) = -pen->en_mRotation(1,2);
    vDown(2) = -pen->en_mRotation(2,2);
    vDown(3) = -pen->en_mRotation(3,2);

    // [Cecil] For rotation towards a plane
    BOOL bRotateToPlane = (pen->en_ulPhysicsFlags & EPF_ROTATETOPLANE);

    // find angle entities down and gravity down
    FLOAT fCos = vDown % (bRotateToPlane ? vRotationDir : pen->en_vGravityDir); // [Cecil]
    // if substantial
    if (fCos<0.99999f) {
      // mark
      pen->en_ulPhysicsFlags |= EPF_ORIENTINGTOGRAVITY;

      // limit the angle rotation
      ANGLE a = ACos(fCos);
      if (Abs(a)>20) {
        a = 20*Sgn(a);
      }
      FLOAT fRad = RadAngle(a);

      // make rotation axis
      FLOAT3D vAxis = vDown * (bRotateToPlane ? vRotationDir : pen->en_vGravityDir); // [Cecil]
      FLOAT fLen = vAxis.Length();
      if (fLen<0.01f) {
        vAxis(1) = pen->en_mRotation(1,3);
        vAxis(2) = pen->en_mRotation(2,3);
        vAxis(3) = pen->en_mRotation(3,3);
      // NOTE: must have this patch for smooth rocking on moving brushes
      // (should infact do fRad/=fLen always)
      } else if (!bReferenceRotatingNonY) {
        fRad/=fLen;
      }
      vAxis *= fRad;

      // make rotation matrix
      FLOATmatrix3D mGRotation;
      mGRotation(1,1) =  1;        mGRotation(1,2) = -vAxis(3); mGRotation(1,3) =  vAxis(2);
      mGRotation(2,1) =  vAxis(3); mGRotation(2,2) =  1;        mGRotation(2,3) = -vAxis(1);
      mGRotation(3,1) = -vAxis(2); mGRotation(3,2) =  vAxis(1); mGRotation(3,3) = 1;
      OrthonormalizeRotationMatrix(mGRotation);

      // add the gravity rotation
      mRotationAbsolute = mGRotation*mRotationAbsolute;
    }
  }

  // initially not floating
  pen->en_ulPhysicsFlags &= ~EPF_FLOATING;

  FLOAT ACC = pen->en_fAcceleration*fTickQuantum*fTickQuantum;
  FLOAT DEC = pen->en_fDeceleration*fTickQuantum*fTickQuantum;

  // if the entity is not affected by gravity
  if (!(pen->en_ulPhysicsFlags & EPF_TRANSLATEDBYGRAVITY)) {
    // accellerate towards desired absolute translation
    if (pen->en_ulPhysicsFlags & EPF_NOACCELERATION) {
      vTranslationAbsolute = vDesiredTranslationAbsolute;
    } else {
      AddAcceleration(vTranslationAbsolute, vDesiredTranslationAbsolute, 
        ACC*fControlMultiplier,
        DEC*fControlMultiplier);
    }
  // if swimming
  } else if ((fBouyancy*pen->en_fGravityA<0.5f && (ctDn.ct_ulFlags&(CTF_SWIMABLE|CTF_FLYABLE)))) {
    // mark that
    pen->en_ulPhysicsFlags|=EPF_FLOATING;
    // accellerate towards desired absolute translation
    if (pen->en_ulPhysicsFlags&EPF_NOACCELERATION) {
      vTranslationAbsolute = vDesiredTranslationAbsolute;
    } else {
      AddAcceleration(vTranslationAbsolute, vDesiredTranslationAbsolute, 
        ACC*fControlMultiplier,
        DEC*fControlMultiplier);
    }

    // add gravity acceleration
    if (fBouyancy<-0.1f) {
      FLOAT fGV=pen->en_fGravityV*fTickQuantum*fSpeedModifier;
      FLOAT fGA=(pen->en_fGravityA*-fBouyancy)*fTickQuantum*fTickQuantum;
      AddAcceleration(vTranslationAbsolute, pen->en_vGravityDir*-fGV, fGA, fGA);
    } else if (fBouyancy>+0.1f) {
      FLOAT fGV=pen->en_fGravityV*fTickQuantum*fSpeedModifier;
      FLOAT fGA=(pen->en_fGravityA*fBouyancy)*fTickQuantum*fTickQuantum;
      AddAcceleration(vTranslationAbsolute, pen->en_vGravityDir*fGV, fGA, fGA);
    }

  // if the entity is affected by gravity
  } else {
    BOOL bGravityAlongPolygon = TRUE;
    // if there is no fixed remembered stand-on polygon or the entity is not on it anymore
    if (pen->en_pbpoStandOn==NULL || !pen->IsStandingOnPolygon(pen->en_pbpoStandOn) || bReferenceMovingInY
      || (pen->en_ulPhysicsFlags&EPF_ORIENTINGTOGRAVITY)) {
      // clear the stand on polygon
      pen->en_pbpoStandOn=NULL;
      if (pen->en_penReference == NULL || bReferenceMovingInY) {
        bGravityAlongPolygon = FALSE;
      }
    }

    // if gravity can cause the entity to fall
    if (!bGravityAlongPolygon) {
      // add gravity acceleration
      FLOAT fGV=pen->en_fGravityV*fTickQuantum*fSpeedModifier;
      FLOAT fGA=(pen->en_fGravityA*fBouyancy)*fTickQuantum*fTickQuantum;
      AddGAcceleration(vTranslationAbsolute, pen->en_vGravityDir, fGA, fGV);
    // if entity can only slide down its stand-on polygon
    } else {
      // disassemble gravity to parts parallel and normal to plane
      FLOAT3D vPolygonDir = -pen->en_vReferencePlane;
      // NOTE: normal to plane=paralel to plane normal vector!
      FLOAT3D vGParallel, vGNormal;
      GetParallelAndNormalComponents(pen->en_vGravityDir, vPolygonDir, vGNormal, vGParallel);
      // add gravity part parallel to plane
      FLOAT fFactor = vGParallel.Length();

      if (fFactor>0.001f) {
        FLOAT fGV=pen->en_fGravityV*fTickQuantum*fSpeedModifier;
        FLOAT fGA=(pen->en_fGravityA*fBouyancy)*fTickQuantum*fTickQuantum;
        AddGAcceleration(vTranslationAbsolute, vGParallel/fFactor, fGA*fFactor, fGV*fFactor);
      }

      // kill your normal-to-polygon speed if towards polygon and small
      FLOAT fPolyGA = (vPolygonDir%pen->en_vGravityDir)*pen->en_fGravityA;
      FLOAT fYSpeed = vPolygonDir%vTranslationAbsolute;
      if (fYSpeed>0 && fYSpeed < fPolyGA) {
        vTranslationAbsolute -= vPolygonDir*fYSpeed;
      }

      // if a bouncer
      if ((pen->en_ulPhysicsFlags & EPF_ONBLOCK_MASK) == EPF_ONBLOCK_BOUNCE) {
        // rotate slower
        pen->en_aDesiredRotationRelative *= pen->en_fJumpControlMultiplier;
        if (pen->en_aDesiredRotationRelative.Length()<10) {
          pen->en_aDesiredRotationRelative = ANGLE3D(0,0,0);
        }
      }
    }

    CSurfaceType &stReference = pen->en_pwoWorld->wo_astSurfaceTypes[pen->en_iReferenceSurface];

    // if it has a reference entity
    if (pen->en_penReference!=NULL) {
      FLOAT fPlaneY = (pen->en_vGravityDir%pen->en_vReferencePlane);
      FLOAT fPlaneYAbs = Abs(fPlaneY);
      FLOAT fFriction = stReference.st_fFriction;
      // if on a steep slope
      if (fPlaneY>=-stReference.st_fClimbSlopeCos&&fPlaneY<0
        ||(stReference.st_ulFlags&STF_SLIDEDOWNSLOPE)&&fPlaneY>-0.99f) {
        pen->en_ulPhysicsFlags |= EPF_ONSTEEPSLOPE;
        // accellerate horizontaly towards desired absolute translation
        AddAccelerationOnPlane2(
          vTranslationAbsolute, 
          vDesiredTranslationAbsolute,
          ACC*fPlaneYAbs*fPlaneYAbs*fFriction*fControlMultiplier,
          DEC*fPlaneYAbs*fPlaneYAbs*fFriction*fControlMultiplier,
          pen->en_vReferencePlane,
          pen->en_vGravityDir);
      // if not on a steep slope
      } else {
        pen->en_ulPhysicsFlags &= ~EPF_ONSTEEPSLOPE;
        // accellerate on plane towards desired absolute translation
        AddAccelerationOnPlane(
          vTranslationAbsolute, 
          vDesiredTranslationAbsolute,
          ACC*fPlaneYAbs*fPlaneYAbs*fFriction*fControlMultiplier,
          DEC*fPlaneYAbs*fPlaneYAbs*fFriction*fControlMultiplier,
          pen->en_vReferencePlane);
      }
      // if wants to jump and can jump
      if (fJump<-0.01f && (fPlaneY<-stReference.st_fJumpSlopeCos
        || _pTimer->CurrentTick()>pen->en_tmLastSignificantVerticalMovement+0.25f) ) {
        // jump
        vTranslationAbsolute += pen->en_vGravityDir*fJump;
        pen->en_tmJumped = _pTimer->CurrentTick();
        pen->en_pbpoStandOn = NULL;
      }

    // if it doesn't have a reference entity
    } else {//if (en_penReference==NULL) 
      // if can control after jump
      if (_pTimer->CurrentTick()-pen->en_tmJumped<pen->en_tmMaxJumpControl) {
        // accellerate horizontaly, but slower
        AddAccelerationOnPlane(
          vTranslationAbsolute, 
          vDesiredTranslationAbsolute,
          ACC*fControlMultiplier*pen->en_fJumpControlMultiplier,
          DEC*fControlMultiplier*pen->en_fJumpControlMultiplier,
          FLOATplane3D(pen->en_vGravityDir, 0));
      }

      // if wants to jump and can jump
      if (fJump<-0.01f && 
        _pTimer->CurrentTick()>pen->en_tmLastSignificantVerticalMovement+0.25f) {
        // jump
        vTranslationAbsolute += pen->en_vGravityDir*fJump;
        pen->en_tmJumped = _pTimer->CurrentTick();
        pen->en_pbpoStandOn = NULL;
      }
    }
  }

  // check for force-field acceleration
  // NOTE: pulled out because of a bug in VC code generator, see function comments above
  CheckAndAddGAcceleration(pen, vTranslationAbsolute, fTickQuantum);

  // if there is fluid friction involved
  if (fFluidFriction>0.01f) {
    // slow down
    AddAcceleration(vTranslationAbsolute, FLOAT3D(0.0f, 0.0f, 0.0f),
      0.0f, DEC*fFluidFriction);
  }

  // if may slow down spinning
  if ( (pen->en_ulPhysicsFlags& EPF_CANFADESPINNING) &&
    ( (ctDn.ct_ulFlags&CTF_FADESPINNING) || (ctUp.ct_ulFlags&CTF_FADESPINNING) ) ) {
    // reduce desired rotation
    pen->en_aDesiredRotationRelative *= (1-fSpeedModifier*0.05f);
    if (pen->en_aDesiredRotationRelative.Length()<10) {
      pen->en_aDesiredRotationRelative = ANGLE3D(0,0,0);
    }
  }

  // discard reference entity (will be recalculated)
  if (pen->en_pbpoStandOn==NULL && (vTranslationAbsolute.ManhattanNorm()>1E-5f || 
    pen->en_vReferencePlane%pen->en_vGravityDir<0.0f)) {
    pen->en_penReference = NULL;
    pen->en_vReferencePlane = FLOAT3D(0.0f, 0.0f, 0.0f);
    pen->en_iReferenceSurface = 0;
  }

  pen->en_vIntendedTranslation = vTranslationAbsolute;
  pen->en_mIntendedRotation = mRotationAbsolute;

  //-- estimate future movements for collision caching

  // make box of the entity for its current rotation
  FLOATaabbox3D box;
  pen->en_pciCollisionInfo->MakeBoxAtPlacement(FLOAT3D(0,0,0), pen->en_mRotation, box);
  // if it is a light source
  {CLightSource *pls = pen->GetLightSource();
  if (pls!=NULL && !(pls->ls_ulFlags&LSF_LENSFLAREONLY)) {
    // expand the box to be sure that it contains light range
    ASSERT(!(pls->ls_ulFlags & LSF_DIRECTIONAL));
    box |= FLOATaabbox3D(FLOAT3D(0,0,0), pls->ls_rFallOff);
  }}
  // add a bit around it
  box.ExpandByFactor(_pShell->GetFLOAT("phy_fCollisionCacheAround") - 1.0f);
  // make box go few ticks ahead of the entity
  box += pen->en_plPlacement.pl_PositionVector;
  pen->en_boxMovingEstimate  = box;
  box += pen->en_vIntendedTranslation * _pShell->GetFLOAT("phy_fCollisionCacheAhead");
  pen->en_boxMovingEstimate |= box;

  // clear applied movement to be updated during movement
  pen->en_vAppliedTranslation = FLOAT3D(0.0f, 0.0f, 0.0f);
  pen->en_mAppliedRotation.Diagonal(1.0f);
};