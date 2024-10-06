/* Copyright (c) 2002-2012 Croteam Ltd. 
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

1
%{
#include "StdH.h"
%}

uses "EntitiesMP/Cecil/Collision/WorldCollision";

// [Cecil] Custom collision shapes
enum ECollisionShape {
  0 COLSH_BOX      "Box",
  1 COLSH_SPHERE   "Sphere",
  2 COLSH_CYLINDER "Cylinder",
  3 COLSH_CAPSULE  "Capsule",
};

class export CCecilMovableEntity : CRationalEntity {
name      "MovableEntity";
thumbnail "";

properties:
  // NOTE: all properties that are not marked as 'adjustable' should be threated read-only

  // translation and rotation speed that this entity would like to have (in relative system)
  1 FLOAT3D en_vDesiredTranslationRelative = FLOAT3D(0.0f,0.0f,0.0f),
  2 ANGLE3D en_aDesiredRotationRelative = ANGLE3D(0,0,0),

  // translation and rotation speed that this entity currently has in absolute system
  3 FLOAT3D en_vCurrentTranslationAbsolute = FLOAT3D(0.0f,0.0f,0.0f),
  4 ANGLE3D en_aCurrentRotationAbsolute = ANGLE3D(0,0,0),

  6 CEntityPointer en_penReference, // reference entity (for standing on)
  7 FLOAT3D en_vReferencePlane = FLOAT3D(0.0f,0.0f,0.0f),   // reference plane (only for standing on)
  8 INDEX en_iReferenceSurface = 0,     // surface on reference entity
  9 CEntityPointer en_penLastValidReference,  // last valid reference entity (for impact damage)
 14 FLOAT en_tmLastSignificantVerticalMovement = 0.0f,   // last time entity moved significantly up/down
  // swimming parameters
 10 FLOAT en_tmLastBreathed = 0,        // last time when entity took some air
 11 FLOAT en_tmMaxHoldBreath = 5.0f,    // how long can entity be without air (adjustable)
 12 FLOAT en_fDensity = 5000.0f,        // density of the body [kg/m3] - defines buoyancy (adjustable)
 13 FLOAT en_tmLastSwimDamage = 0,      // last time when entity was damaged by swimming
 // content immersion parameters
 20 INDEX en_iUpContent = 0,
 21 INDEX en_iDnContent = 0,
 22 FLOAT en_fImmersionFactor = 1.0f,
 // force parameters
 25 FLOAT3D en_vGravityDir = FLOAT3D(0,-1,0),
 26 FLOAT en_fGravityA = 0.0f,
 27 FLOAT en_fGravityV = 0.0f,
 66 FLOAT3D en_vForceDir = FLOAT3D(1,0,0),
 67 FLOAT en_fForceA = 0.0f,
 68 FLOAT en_fForceV = 0.0f,
 // jumping parameters
 30 FLOAT en_tmJumped = 0,            // time when entity jumped
 31 FLOAT en_tmMaxJumpControl = 0.5f,  // how long after jump can have control in the air [s] (adjustable)
 32 FLOAT en_fJumpControlMultiplier = 0.5f,  // how good is control when jumping (adjustable)
 // movement parameters
 35 FLOAT en_fAcceleration = 200.0f,  // acc/decc [m/s2] in ideal situation (adjustable)
 36 FLOAT en_fDeceleration = 40.0f,

 37 FLOAT en_fStepUpHeight = 1.0f,        // how high can entity step upstairs (adjustable)
 42 FLOAT en_fStepDnHeight = -1.0f,       // how low can entity step (negative means don't check) (adjustable)
 38 FLOAT en_fBounceDampParallel = 0.5f,  // damping parallel to plane at each bounce (adjustable)
 39 FLOAT en_fBounceDampNormal   = 0.5f,  // damping normal to plane damping at each bounce (adjustable)
 // collision damage control
 40 FLOAT en_fCollisionSpeedLimit = 20.0f,      // max. collision speed without damage (adjustable)
 41 FLOAT en_fCollisionDamageFactor = 20.0f,    // collision damage ammount multiplier (adjustable)

 51 FLOATaabbox3D en_boxMovingEstimate = FLOATaabbox3D(FLOAT3D(0,0,0), 0.01f), // overestimate of movement in next few ticks
 52 FLOATaabbox3D en_boxNearCached = FLOATaabbox3D(FLOAT3D(0,0,0), 0.01f),     // box in which the polygons are cached

 // intended movement in this tick
 64  FLOAT3D en_vIntendedTranslation = FLOAT3D(0,0,0),  // can be read on receiving a touch event, holds last velocity before touch
 65  FLOATmatrix3D en_mIntendedRotation = FLOATmatrix3D(0),

{
// these are not saved via the property system
  
  CPlacement3D en_plLastPlacement;  // placement in last tick (used for lerping) (not saved)
  CListNode en_lnInMovers;          // node in list of moving entities  (saved as bool)

  CBrushPolygon *en_pbpoStandOn; // cached last polygon standing on, just for optimization
  // used for caching near polygons of zoning brushes for fast collision detection
  CStaticStackArray<CBrushPolygon *> en_apbpoNearPolygons;  // cached polygons

  FLOAT en_tmLastPredictionHead;
  FLOAT3D en_vLastHead;
  FLOAT3D en_vPredError;
  FLOAT3D en_vPredErrorLast;

  // these are really temporary - should never be used across ticks
  // next placement for collision detection
  FLOAT3D en_vNextPosition;
  FLOATmatrix3D en_mNextRotation;

  // delta for this movement
  FLOAT3D en_vMoveTranslation;
  FLOATmatrix3D en_mMoveRotation;
  // aplied movement in this tick
  FLOAT3D en_vAppliedTranslation;
  FLOATmatrix3D en_mAppliedRotation;
}

components:

functions:
  void ResetPredictionFilter(void)
  {
    en_tmLastPredictionHead = -2;
    en_vLastHead = en_plPlacement.pl_PositionVector;
    en_vPredError = en_vPredErrorLast = FLOAT3D(0,0,0);
  }

  /* Constructor. */
  void CCecilMovableEntity(void)
  {
    en_pbpoStandOn = NULL;
    en_apbpoNearPolygons.SetAllocationStep(5);
    ResetPredictionFilter();
  }

  void ~CCecilMovableEntity(void)
  {
  }

  /* Initialization. */
  void OnInitialize(const CEntityEvent &eeInput)
  {
    CRationalEntity::OnInitialize(eeInput);
    ClearTemporaryData();
    en_vIntendedTranslation = FLOAT3D(0,0,0);
    en_mIntendedRotation.Diagonal(1.0f);
    en_boxNearCached = FLOATaabbox3D();
    en_boxMovingEstimate = FLOATaabbox3D();
    en_pbpoStandOn = NULL;
  }

  /* Called before releasing entity. */
  void OnEnd(void)
  {
    // remove from movers if active
    if (en_lnInMovers.IsLinked()) {
      en_lnInMovers.Remove();
    }
    ClearTemporaryData();
    en_boxNearCached = FLOATaabbox3D();
    en_boxMovingEstimate = FLOATaabbox3D();
    CRationalEntity::OnEnd();
  }

  void Copy(CEntity &enOther, ULONG ulFlags)
  {
    CRationalEntity::Copy(enOther, ulFlags);
    CCecilMovableEntity *pmenOther = (CCecilMovableEntity *)(&enOther);

    if (ulFlags&COPY_PREDICTOR) {
      en_plLastPlacement      = pmenOther->en_plLastPlacement      ;
      en_vNextPosition        = pmenOther->en_vNextPosition        ;
      en_mNextRotation        = pmenOther->en_mNextRotation        ;
      en_vAppliedTranslation  = pmenOther->en_vAppliedTranslation  ;
      en_mAppliedRotation     = pmenOther->en_mAppliedRotation     ;
      en_boxNearCached        = pmenOther->en_boxNearCached        ;
      en_boxMovingEstimate    = pmenOther->en_boxMovingEstimate    ;
      en_pbpoStandOn          = pmenOther->en_pbpoStandOn          ;
      en_apbpoNearPolygons    = pmenOther->en_apbpoNearPolygons    ;
    } else {
      ClearTemporaryData();
      en_boxNearCached = FLOATaabbox3D();
      en_boxMovingEstimate = FLOATaabbox3D();
      en_pbpoStandOn = NULL;
    }

    ResetPredictionFilter();
    en_plLastPlacement = pmenOther->en_plLastPlacement;
    if (pmenOther->en_lnInMovers.IsLinked()) {
      AddToMovers();
    }
  }

  void ClearTemporaryData(void)
  {
    en_plLastPlacement = en_plPlacement;
    // init moving parameters so that they are valid for collision if entity is not moving
    en_vNextPosition = en_plPlacement.pl_PositionVector;
    en_mNextRotation = en_mRotation;
    en_vAppliedTranslation = FLOAT3D(0,0,0);
    en_mAppliedRotation.Diagonal(1.0f);
    ResetPredictionFilter();
  }

  void ChecksumForSync(ULONG &ulCRC, INDEX iExtensiveSyncCheck) {
    // [Cecil] Better sync stuff through the same methods
    reinterpret_cast<CMovableEntity *>(this)->CMovableEntity::ChecksumForSync(ulCRC, iExtensiveSyncCheck);
  };

  void DumpSync_t(CTStream &strm, INDEX iExtensiveSyncCheck) {
    // [Cecil] Better sync stuff through the same methods
    reinterpret_cast<CMovableEntity *>(this)->CMovableEntity::DumpSync_t(strm, iExtensiveSyncCheck);
  };

  void Read_t(CTStream *istr) {
    // [Cecil] Better serialize stuff through the same methods
    reinterpret_cast<CMovableEntity *>(this)->CMovableEntity::Read_t(istr);
  };

  void Write_t(CTStream *ostr) {
    // [Cecil] Better serialize stuff through the same methods
    reinterpret_cast<CMovableEntity *>(this)->CMovableEntity::Write_t(ostr);
  };

  // [Cecil] Everything is defined in MovableEntityMethods.cpp for proper code analysis
  CPlacement3D GetLerpedPlacement(void) const;
  void AddToMovers(void);
  void AddToMoversDuringMoving(void);
  void SetDesiredRotation(const ANGLE3D &aRotation);
  const ANGLE3D &GetDesiredRotation(void) const;
  void SetDesiredTranslation(const FLOAT3D &vTranslation);
  const FLOAT3D &GetDesiredTranslation(void) const;

  void GiveImpulseTranslationRelative(const FLOAT3D &vImpulseSpeedRelative);
  void GiveImpulseTranslationAbsolute(const FLOAT3D &vImpulseSpeed);

  void LaunchAsPropelledProjectile(const FLOAT3D &vImpulseSpeedRelative, CMovableEntity *penLauncher);
  void LaunchAsFreeProjectile(const FLOAT3D &vImpulseSpeedRelative, CMovableEntity *penLauncher);

  // [Cecil] Wrappers for compatibility
  inline void LaunchAsPropelledProjectile(const FLOAT3D &vImpulseSpeedRelative, CCecilMovableEntity *penLauncher) {
    LaunchAsPropelledProjectile(vImpulseSpeedRelative, penLauncher);
  };

  inline void LaunchAsFreeProjectile(const FLOAT3D &vImpulseSpeedRelative, CCecilMovableEntity *penLauncher) {
    LaunchAsFreeProjectile(vImpulseSpeedRelative, penLauncher);
  };

  void ForceStopTranslation(void);
  void ForceStopRotation(void);
  void ForceFullStop(void);
  void FakeJump(const FLOAT3D &vOrgSpeed, const FLOAT3D &vDirection, FLOAT fStrength,
    FLOAT fParallelMultiplier, FLOAT fNormalMultiplier, FLOAT fMaxExitSpeed, TIME tmControl);

  ANGLE GetRelativeHeading(const FLOAT3D &vDirection);
  ANGLE GetRelativePitch(const FLOAT3D &vDirection);
  void GetReferenceHeadingDirection(const FLOAT3D &vReference, ANGLE aH, FLOAT3D &vDirection);
  void GetHeadingDirection(ANGLE aH, FLOAT3D &vDirection);
  void GetPitchDirection(ANGLE aH, FLOAT3D &vDirection);

  CEntity *MiscDamageInflictor(void);
  void UpdateOneSectorForce(CBrushSector &bsc, FLOAT fRatio);
  void TestFields(INDEX &iUpContent, INDEX &iDnContent, FLOAT &fImmersionFactor);
  void TestBreathing(CContentType &ctUp);
  void TestContentDamage(CContentType &ctDn, FLOAT fImmersion);
  void TestSurfaceDamage(CSurfaceType &stDn);

  void SendTouchEvent(const CCecilClipMove &cmMove);
  void SendBlockEvent(CCecilClipMove &cmMove);

  // [Cecil] Collision polygons instead of brush polygons
  BOOL IsStandingOnPolygon(const SCollisionPolygon &cpo);
  BOOL IsPolygonBelowPoint(const SCollisionPolygon &cpo, const FLOAT3D &vPoint, FLOAT fMaxDist);

  virtual BOOL AllowForGroundPolygon(CBrushPolygon *pbpo);
  BOOL IsSomeNearPolygonBelowPoint(const FLOAT3D &vPoint, FLOAT fMaxDist);
  BOOL IsSomeSectorPolygonBelowPoint(CBrushSector *pbsc, const FLOAT3D &vPoint, FLOAT fMaxDist);
  BOOL WouldFallInNextPosition(void);
  void ClearNextPosition(void);
  void SetPlacementFromNextPosition(void);

  BOOL TryToGoUpstairs(const FLOAT3D &vTranslationAbsolute, const CSurfaceType &stHit, BOOL bHitStairsOrg);
  BOOL TryToMove(CCecilMovableEntity *penPusher, BOOL bTranslate, BOOL bRotate);
  void ClearMovingTemp(void);

  // [Cecil] Pre-moving logic with an additional rotation direction variable (for EPF_ROTATETOPLANE)
  void PreMoving(FLOAT3D &vRotationDir);

  // [Cecil] NOTE: This virtual function is now a wrapper for compatibility
  void PreMoving(void) {
    FLOAT3D vDummy;
    PreMoving(vDummy);
  };

  void DoMoving(void);
  void PostMoving(void);
  void CacheNearPolygons(void);

  // returns bytes of memory used by this object
  SLONG GetUsedMemory(void) {
    // init
    SLONG slUsedMemory = sizeof(CCecilMovableEntity) - sizeof(CRationalEntity) + CRationalEntity::GetUsedMemory();
    // add some more
    slUsedMemory += en_apbpoNearPolygons.sa_Count * sizeof(CBrushPolygon *);
    return slUsedMemory;
  };

procedures:
  Dummy() {};
};
