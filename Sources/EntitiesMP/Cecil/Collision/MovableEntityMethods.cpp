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

#include <EntitiesMP/Mod/Base/MovableEntity.h>
#include <EntitiesMP/Mod/Base/MovableModelEntity.h>
#include <EntitiesMP/Player.h>

#include "CollisionCommon.h"
#include "WorldCollision.h"

#define CLEARMEM(var) memset(&var, 0, sizeof(var))

// [Cecil] NOTE: This function simply returns TRUE in 1.10
inline BOOL IsTerrainBelowPoint(CTerrain *, const FLOAT3D &, FLOAT, const FLOAT3D &) {
  return TRUE;
};

#define MAXCOLLISIONRETRIES 4*4

CEntity *GetPredictedSafe(CEntity *pen)
{
  if ((pen->en_ulFlags&(ENF_PREDICTOR|ENF_TEMPPREDICTOR)) == ENF_PREDICTOR) {
    return pen->GetPredicted();
  } else {
    return pen;
  }
};

// add acceleration to velocity
static inline void AddAcceleration(
  FLOAT3D &vCurrentVelocity, const FLOAT3D &vDesiredVelocity, 
  FLOAT fAcceleration, FLOAT fDecceleration)
{
  // if desired velocity is smaller than current velocity
  if (vDesiredVelocity.Length()<vCurrentVelocity.Length()) {
    fAcceleration=fDecceleration;
  }
  // find difference between current and desired velocities
  FLOAT3D vDelta = vDesiredVelocity-vCurrentVelocity;
  // accelerate in the direction of the difference with given maximum acceleration
  FLOAT fDelta = vDelta.Length();
  if (fDelta>fAcceleration) {
    vCurrentVelocity += vDelta*(fAcceleration/fDelta);
  } else {
    vCurrentVelocity = vDesiredVelocity;
  }
}

// add gravity acceleration to velocity along an axis
static inline void AddGAcceleration(
  FLOAT3D &vCurrentVelocity, const FLOAT3D &vGDir, 
  FLOAT fGA, FLOAT fGV)
{
  // disassemble speed
  FLOAT3D vCurrentParallel, vCurrentOrthogonal;
  GetParallelAndNormalComponents(vCurrentVelocity, vGDir, vCurrentOrthogonal, vCurrentParallel);

// KLUDGE_BEGIN

  if (_pNetwork->ga_ulDemoMinorVersion<=2) {
    Swap(vCurrentOrthogonal, vCurrentParallel);
  }

  FLOAT3D vCurrentOrthogonalOrg=vCurrentOrthogonal;
  // add accelleration to parallel speed
  vCurrentOrthogonal+=vGDir*fGA;

  // if going down at max speed
  if (vCurrentOrthogonal%vGDir>=fGV) {
    // clamp
    vCurrentOrthogonal = vGDir*fGV;
  } else {
    vCurrentOrthogonalOrg = vCurrentOrthogonal;
  }

  if (_pNetwork->ga_ulDemoMinorVersion>2) {
    vCurrentOrthogonal=vCurrentOrthogonalOrg;
  }
// KLUDGE_END

  // assemble speed back
  vCurrentVelocity = vCurrentParallel+vCurrentOrthogonal;
}

// NOTE:
// this is pulled out into a separate function because, otherwise, VC6 generates
// invalid code when optimizing this. no clue why is that so.

#pragma inline_depth(0)
static void CheckAndAddGAcceleration(CCecilMovableEntity *pen, FLOAT3D &vTranslationAbsolute, FLOAT fTickQuantum)
{
  // if there is forcefield involved
  if (pen->en_fForceA>0.01f) {
    // add force acceleration
    FLOAT fGV=pen->en_fForceV*fTickQuantum;
    FLOAT fGA=pen->en_fForceA*fTickQuantum*fTickQuantum;
    AddGAcceleration(vTranslationAbsolute, pen->en_vForceDir, fGA, fGV);
  }
}
#pragma inline_depth()  // see important note above


// add acceleration to velocity, but only along a plane
static inline void AddAccelerationOnPlane(
  FLOAT3D &vCurrentVelocity, const FLOAT3D &vDesiredVelocity, 
  FLOAT fAcceleration, FLOAT fDecceleration,
  const FLOAT3D &vPlaneNormal)
{
  FLOAT3D vCurrentParallel, vCurrentOrthogonal;
  GetParallelAndNormalComponents(vCurrentVelocity, vPlaneNormal, vCurrentOrthogonal, vCurrentParallel);
  FLOAT3D vDesiredParallel;
  GetNormalComponent(vDesiredVelocity, vPlaneNormal, vDesiredParallel);
  AddAcceleration(vCurrentParallel, vDesiredParallel, fAcceleration, fDecceleration);
  vCurrentVelocity = vCurrentParallel+vCurrentOrthogonal;
}

// add acceleration to velocity, for roller-coaster slope -- slow!
static inline void AddAccelerationOnPlane2(
  FLOAT3D &vCurrentVelocity, const FLOAT3D &vDesiredVelocity, 
  FLOAT fAcceleration, FLOAT fDecceleration,
  const FLOAT3D &vPlaneNormal, const FLOAT3D &vGravity)
{
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
  vCurrentVelocity = vCurrentParallel+vCurrentOrthogonal;
}

// max number of retries during movement
static INDEX _ctTryToMoveCheckCounter;
static INDEX _ctSliding;
static FLOAT3D _vSlideOffDir;   // move away direction for sliding
static FLOAT3D _vSlideDir;

static void InitTryToMove(void)
{
  _ctTryToMoveCheckCounter = MAXCOLLISIONRETRIES;
  _ctSliding = 0;
  _vSlideOffDir = FLOAT3D(0, 0, 0);
  _vSlideDir = FLOAT3D(0, 0, 0);
}

// array of forces for current entity
class CEntityForce {
public:
  CEntityPointer ef_penEntity;
  INDEX ef_iForceType;
  FLOAT ef_fRatio;    // how much of entity this force gets [0-1]

  inline void Clear(void) {
    ef_penEntity = NULL;
  };

  ~CEntityForce(void) {
    Clear();
  };
};

static CStaticStackArray<CEntityForce> _aefForces;

void ClearMovableEntityCaches(void)
{
  _aefForces.Clear();
}

// this one is used in rendering - gets lerped placement between ticks 
CPlacement3D CCecilMovableEntity::GetLerpedPlacement(void) const
{
  // get the lerping factor
  FLOAT fLerpFactor;
  if (IsPredictor()) {
    fLerpFactor = _pTimer->GetLerpFactor();
  } else {
    fLerpFactor = _pTimer->GetLerpFactor2();
  }
  CPlacement3D plLerped;
  plLerped.Lerp(en_plLastPlacement, en_plPlacement, fLerpFactor);

  CCecilMovableEntity *penTail = (CCecilMovableEntity *)GetPredictedSafe((CEntity *)this);

  // [Cecil] _bPredictionActive is unavailable, so recalculate it in place
  static CSymbolPtr pbPrediction("cli_bPrediction");
  static CSymbolPtr pbPredictIfServer("cli_bPredictIfServer");
  static CSymbolPtr pfPredictionFilter("cli_fPredictionFilter");
  BOOL _bPredictionActive = pbPrediction.GetIndex() && (pbPredictIfServer.GetIndex() || !_pNetwork->IsServer());

  // if should filter predictions
  if (_bPredictionActive) {
    // add the smoothed error
    FLOAT3D vError = penTail->en_vPredError;
    vError *= pow(pfPredictionFilter.GetFloat(), fLerpFactor);
    plLerped.pl_PositionVector -= vError;
  }

  return plLerped;
}

/* Add yourself to list of movers. */
void CCecilMovableEntity::AddToMovers(void)
{
  if (!en_lnInMovers.IsLinked()) {
    en_pwoWorld->wo_lhMovers.AddTail(en_lnInMovers);
  }
}

void CCecilMovableEntity::AddToMoversDuringMoving(void) // used for recursive adding
{
  // if already added
  if (en_lnInMovers.IsLinked()) {
    // do nothing
    return;
  }
  // add it
  AddToMovers();

  // mark that it was forced to add
  en_ulPhysicsFlags |= EPF_FORCEADDED;
}

/* Set desired rotation speed of movable entity. */
void CCecilMovableEntity::SetDesiredRotation(const ANGLE3D &aRotation) 
{
  en_aDesiredRotationRelative = aRotation;
  AddToMovers();
}

const ANGLE3D &CCecilMovableEntity::GetDesiredRotation(void) const {
  return en_aDesiredRotationRelative;
};

/* Set desired translation speed of movable entity. */
void CCecilMovableEntity::SetDesiredTranslation(const FLOAT3D &vTranslation) 
{
  en_vDesiredTranslationRelative = vTranslation;
  AddToMovers();
}

const FLOAT3D &CCecilMovableEntity::GetDesiredTranslation(void) const {
  return en_vDesiredTranslationRelative;
};

/* Add an impulse to the current speed of the entity (used for instantaneous launching). */
void CCecilMovableEntity::GiveImpulseTranslationRelative(const FLOAT3D &vImpulseSpeedRelative)
{
  CPlacement3D plImpulseSpeedAbsolute( vImpulseSpeedRelative, ANGLE3D(0,0,0)); 
  plImpulseSpeedAbsolute.RelativeToAbsolute(
    CPlacement3D(FLOAT3D(0.0f,0.0f,0.0f), en_plPlacement.pl_OrientationAngle));
  en_vCurrentTranslationAbsolute += plImpulseSpeedAbsolute.pl_PositionVector;
  AddToMovers();
}

void CCecilMovableEntity::GiveImpulseTranslationAbsolute(const FLOAT3D &vImpulseSpeed)
{
  en_vCurrentTranslationAbsolute += vImpulseSpeed;
  AddToMovers();
}

void CCecilMovableEntity::LaunchAsPropelledProjectile(const FLOAT3D &vImpulseSpeedRelative, 
  CMovableEntity *penLauncher)
{
  en_vDesiredTranslationRelative = vImpulseSpeedRelative;
  en_vCurrentTranslationAbsolute += vImpulseSpeedRelative*en_mRotation;
//    en_vCurrentTranslationAbsolute += penLauncher->en_vCurrentTranslationAbsolute;
  AddToMovers();
}

void CCecilMovableEntity::LaunchAsFreeProjectile(const FLOAT3D &vImpulseSpeedRelative, 
  CMovableEntity *penLauncher)
{
  en_vCurrentTranslationAbsolute += vImpulseSpeedRelative*en_mRotation;
//    en_vCurrentTranslationAbsolute += penLauncher->en_vCurrentTranslationAbsolute;
//    en_fAcceleration = en_fDeceleration = 0.0f;
  AddToMovers();
}

/* Stop all translation */
void CCecilMovableEntity::ForceStopTranslation(void) {
  en_vDesiredTranslationRelative = FLOAT3D(0.0f,0.0f,0.0f);
  en_vCurrentTranslationAbsolute = FLOAT3D(0.0f,0.0f,0.0f);
  en_vAppliedTranslation = FLOAT3D(0.0f,0.0f,0.0f);
}

/* Stop all rotation */
void CCecilMovableEntity::ForceStopRotation(void) {
  en_aDesiredRotationRelative = ANGLE3D(0,0,0);
  en_aCurrentRotationAbsolute = ANGLE3D(0,0,0);
  en_mAppliedRotation.Diagonal(1.0f);
}

/* Stop at once in place */
void CCecilMovableEntity::ForceFullStop(void) {
  ForceStopTranslation();
  ForceStopRotation();
}

/* Fake that the entity jumped (for jumppads) */
void CCecilMovableEntity::FakeJump(const FLOAT3D &vOrgSpeed, const FLOAT3D &vDirection, FLOAT fStrength,
  FLOAT fParallelMultiplier, FLOAT fNormalMultiplier, FLOAT fMaxExitSpeed, TIME tmControl)
{
  // fixup jump time for right control
  en_tmJumped = _pTimer->CurrentTick() - en_tmMaxJumpControl + tmControl;

  // apply parallel and normal component multipliers
  FLOAT3D vCurrentNormal;
  FLOAT3D vCurrentParallel;
  GetParallelAndNormalComponents(vOrgSpeed, vDirection, vCurrentParallel, vCurrentNormal);

  // compile translation vector
  en_vCurrentTranslationAbsolute = 
    vCurrentParallel * fParallelMultiplier + 
    vCurrentNormal * fNormalMultiplier +
    vDirection * fStrength;

  // clamp translation speed
  FLOAT fLength = en_vCurrentTranslationAbsolute.Length();

  if (fLength > fMaxExitSpeed) {
    en_vCurrentTranslationAbsolute = en_vCurrentTranslationAbsolute / fLength * fMaxExitSpeed;
  }

  // no reference while bouncing
  en_penReference = NULL;
  en_pbpoStandOn = NULL;

  // [Cecil]
  if (IsDerivedFromID(this, CPlayer_ClassID)) {
    CPlayer *penPlayer = (CPlayer *)this;
    penPlayer->m_cpoStandOn.Reset();
  }

  en_vReferencePlane = FLOAT3D(0.0f, 0.0f, 0.0f);
  en_iReferenceSurface = 0;

  // add to movers
  AddToMovers();
}

/* Get relative angles from direction angles. */
ANGLE CCecilMovableEntity::GetRelativeHeading(const FLOAT3D &vDirection) {
  ASSERT(Abs(vDirection.Length()-1)<0.001f); // must be normalized!
  // get front component of vector
  FLOAT fFront = 
    -vDirection(1)*en_mRotation(1,3)
    -vDirection(2)*en_mRotation(2,3)
    -vDirection(3)*en_mRotation(3,3);
  // get left component of vector
  FLOAT fLeft = 
    -vDirection(1)*en_mRotation(1,1)
    -vDirection(2)*en_mRotation(2,1)
    -vDirection(3)*en_mRotation(3,1);
  // relative heading is arctan of angle between front and left
  return ATan2(fLeft, fFront);
}
ANGLE CCecilMovableEntity::GetRelativePitch(const FLOAT3D &vDirection) {
  ASSERT(Abs(vDirection.Length()-1)<0.001f); // must be normalized!
  // get front component of vector
  FLOAT fFront = 
    -vDirection(1)*en_mRotation(1,3)
    -vDirection(2)*en_mRotation(2,3)
    -vDirection(3)*en_mRotation(3,3);
  // get up component of vector
  FLOAT fUp = 
    +vDirection(1)*en_mRotation(1,2)
    +vDirection(2)*en_mRotation(2,2)
    +vDirection(3)*en_mRotation(3,2);
  // relative pitch is arctan of angle between front and up
  return ATan2(fUp, fFront);
}

/* Get absolute direction for a heading relative to another direction. */
void CCecilMovableEntity::GetReferenceHeadingDirection(const FLOAT3D &vReference, ANGLE aH, FLOAT3D &vDirection) {
  ASSERT(Abs(vReference.Length()-1)<0.001f); // must be normalized!
  FLOAT3D vY(en_mRotation(1,2), en_mRotation(2,2), en_mRotation(3,2));
  FLOAT3D vX = (vY*vReference).Normalize();
  FLOAT3D vMZ = vY*vX;
  vDirection = -vX*Sin(aH)+vMZ*Cos(aH);
}

/* Get absolute direction for a heading relative to current direction. */
void CCecilMovableEntity::GetHeadingDirection(ANGLE aH, FLOAT3D &vDirection) {
  FLOAT3D vX(en_mRotation(1,1), en_mRotation(2,1), en_mRotation(3,1));
  FLOAT3D vZ(en_mRotation(1,3), en_mRotation(2,3), en_mRotation(3,3));
  vDirection = -vX*Sin(aH)-vZ*Cos(aH);
}

/* Get absolute direction for a pitch relative to current direction. */
void CCecilMovableEntity::GetPitchDirection(ANGLE aH, FLOAT3D &vDirection) {
  FLOAT3D vY(en_mRotation(1,2), en_mRotation(2,2), en_mRotation(3,2));
  FLOAT3D vZ(en_mRotation(1,3), en_mRotation(2,3), en_mRotation(3,3));
  vDirection = -vZ*Cos(aH)+vY*Sin(aH);
}

// get a valid inflictor for misc damage (last brush or this)
CEntity *CCecilMovableEntity::MiscDamageInflictor(void)
{
  // NOTE: must be damaged by some brush if possible, because enemies are set up so
  // that they cannot harm themselves.
  if (en_penLastValidReference!=NULL) {
    return en_penLastValidReference;
  } else {
    CBrushSector *pbsc = GetFirstSector();
    if (pbsc==NULL) {
      return this;
    } else {
      return pbsc->bsc_pbmBrushMip->bm_pbrBrush->br_penEntity;
    }
  }
}

// add the sector force
void CCecilMovableEntity::UpdateOneSectorForce(CBrushSector &bsc, FLOAT fRatio)
{
  // if not significantly
  if (fRatio<0.01f) {
    // just ignore it
    return;
  }
  INDEX iForceType = bsc.GetForceType();
  CEntity *penEntity = bsc.bsc_pbmBrushMip->bm_pbrBrush->br_penEntity;

  // try to find the force in container
  CEntityForce *pef = NULL;
  for(INDEX iForce=0; iForce<_aefForces.Count(); iForce++) {
    if (penEntity ==_aefForces[iForce].ef_penEntity
      &&iForceType==_aefForces[iForce].ef_iForceType) {
      pef = &_aefForces[iForce];
      break;
    }
  }
   
  // if field is not found
  if (pef==NULL) {
    // add a new one
    pef = _aefForces.Push(1);
    pef->ef_penEntity = penEntity;
    pef->ef_iForceType = iForceType;
    pef->ef_fRatio = 0.0f;
  }
  pef->ef_fRatio+=fRatio;
}

// test for field containment
void CCecilMovableEntity::TestFields(INDEX &iUpContent, INDEX &iDnContent, FLOAT &fImmersionFactor)
{
  // this works only for models
  ASSERT(en_RenderType==RT_MODEL || en_RenderType==RT_EDITORMODEL || en_RenderType==RT_SKAMODEL || en_RenderType==RT_SKAEDITORMODEL);
  iUpContent = 0;
  iDnContent = 0;
  FLOAT fUp = 0.0f;
  FLOAT fDn = 0.0f;

  FLOAT3D &vOffset = en_plPlacement.pl_PositionVector;
  FLOATmatrix3D &mRotation = en_mRotation;
  // project height min/max in the entity to absolute space
  FLOAT3D vMin = FLOAT3D(0, en_pciCollisionInfo->ci_fMinHeight, 0);
  FLOAT3D vMax = FLOAT3D(0, en_pciCollisionInfo->ci_fMaxHeight, 0);
  vMin = vMin*mRotation+vOffset;
  vMax = vMax*mRotation+vOffset;
  // project all spheres in the entity to absolute space (for touch field testing)
  CStaticArray<CMovingSphere> &absSpheres = en_pciCollisionInfo->ci_absSpheres;
  FOREACHINSTATICARRAY(absSpheres, CMovingSphere, itms) {
    itms->ms_vRelativeCenter0 = itms->ms_vCenter*mRotation+vOffset;
  }

  // clear forces
  _aefForces.PopAll();
  // for each sector that this entity is in
  {FOREACHSRCOFDST(en_rdSectors, CBrushSector, bsc_rsEntities, pbsc)
    CBrushSector &bsc = *pbsc;
    // if this sector is not in first mip
    if (!bsc.bsc_pbmBrushMip->IsFirstMip()) {
      // skip it
      continue;
    }
    // get entity of the sector
    CEntity *penSector = bsc.bsc_pbmBrushMip->bm_pbrBrush->br_penEntity;

    // if not real brush
    if (penSector->en_RenderType!=RT_BRUSH) {
      // skip it
      continue;
    }

    // get min/max parameters of entity inside sector
    double dMin, dMax;
    bsc.bsc_bspBSPTree.FindLineMinMax(FLOATtoDOUBLE(vMin), FLOATtoDOUBLE(vMax), dMin, dMax);

    // if sector content is not default
    INDEX iContent = bsc.GetContentType();
    if (iContent!=0) {
      // if inside sector at all
      if (dMax>0.0f && dMin<1.0f) {
        //CPrintF("%s: %lf %lf    ", bsc.bsc_strName, dMin, dMax);
        // if minimum is small
        if (dMin<0.01f) {
          // update down content
          iDnContent = iContent;
          fDn = Max(fDn, FLOAT(dMax));
        }
        // if maximum is large
        if (dMax>0.99f) {
          // update up content
          iUpContent = iContent;
          fUp = Max(fUp, 1-FLOAT(dMin));
        }
      }
    }

    // add the sector force
    UpdateOneSectorForce(bsc, dMax-dMin);

  ENDFOR;}
  //CPrintF("%f %d %f %d\n", fDn, iDnContent, fUp, iUpContent);

  // if same contents
  if (iUpContent == iDnContent) {
    // trivial case
    fImmersionFactor = 1.0f;
  // if different contents
  } else {
    // calculate immersion factor
    if (iUpContent==0) {
      fImmersionFactor = fDn;
    } else if (iDnContent==0) {
      fImmersionFactor = 1-fUp;
    } else {
      fImmersionFactor = Max(fDn, 1-fUp);
    }
    // eliminate degenerate cases
    if (fImmersionFactor<0.01f) {
      fImmersionFactor = 1.0f;
      iDnContent = iUpContent;
    } else if (fImmersionFactor>0.99f) {
      fImmersionFactor = 1.0f;
      iUpContent = iDnContent;
    }
  }

  // clear force container and calculate average forces
  FLOAT3D vGravityA(0,0,0);
  FLOAT3D vGravityV(0,0,0);
  FLOAT3D vForceA(0,0,0);
  FLOAT3D vForceV(0,0,0);
  FLOAT fRatioSum = 0.0f;

  {for(INDEX iForce=0; iForce<_aefForces.Count(); iForce++) {
    CForceStrength fsGravity;
    CForceStrength fsField;
    _aefForces[iForce].ef_penEntity->GetForce(
      _aefForces[iForce].ef_iForceType, en_plPlacement.pl_PositionVector, 
      fsGravity, fsField);
    FLOAT fRatio = _aefForces[iForce].ef_fRatio;
    fRatioSum+=fRatio;
    vGravityA+=fsGravity.fs_vDirection*fsGravity.fs_fAcceleration*fRatio;
    vGravityV+=fsGravity.fs_vDirection*fsGravity.fs_fVelocity*fRatio;
    if (fsField.fs_fAcceleration>0) {
      vForceA+=fsField.fs_vDirection*fsField.fs_fAcceleration*fRatio;
      vForceV+=fsField.fs_vDirection*fsField.fs_fVelocity*fRatio;
    }
    _aefForces[iForce].Clear();
  }}
  if (fRatioSum>0) {
    vGravityA/=fRatioSum;
    vGravityV/=fRatioSum;
    vForceA/=fRatioSum;
    vForceV/=fRatioSum;
  }
  en_fGravityA = vGravityA.Length();
  if (en_fGravityA<0.01f) {
    en_fGravityA = 0;
  } else {
    en_fGravityV = vGravityV.Length();
    en_vGravityDir = vGravityA/en_fGravityA;
  }
  en_fForceA = vForceA.Length();
  if (en_fForceA<0.01f) {
    en_fForceA = 0;
  } else {
    en_fForceV = vForceV.Length();
    en_vForceDir = vForceA/en_fForceA;
  }
  _aefForces.PopAll();
}

// test entity breathing
void CCecilMovableEntity::TestBreathing(CContentType &ctUp) 
{
  // if this entity doesn't breathe
  if (!(en_ulPhysicsFlags&(EPF_HASLUNGS|EPF_HASGILLS))) {
    // do nothing
    return;
  }
  // find current breathing parameters
  BOOL bCanBreathe = 
    (ctUp.ct_ulFlags&CTF_BREATHABLE_LUNGS) && (en_ulPhysicsFlags&EPF_HASLUNGS) ||
    (ctUp.ct_ulFlags&CTF_BREATHABLE_GILLS) && (en_ulPhysicsFlags&EPF_HASGILLS);
  TIME tmNow = _pTimer->CurrentTick();
  TIME tmBreathDelay = tmNow-en_tmLastBreathed;
  // if entity can breathe now
  if (bCanBreathe) {
    // update breathing time
    en_tmLastBreathed = tmNow;
    // if it was without air for some time
    if (tmBreathDelay>_pTimer->TickQuantum*2) {
      // notify entity that it has take air now
      ETakingBreath eTakingBreath;
      eTakingBreath.fBreathDelay = tmBreathDelay/en_tmMaxHoldBreath;
      SendEvent(eTakingBreath);
    }
  // if entity can not breathe now
  } else {
    // if it was without air for too long
    if (tmBreathDelay>en_tmMaxHoldBreath) {
      // inflict drowning damage 
      InflictDirectDamage(this, MiscDamageInflictor(), DMT_DROWNING, ctUp.ct_fDrowningDamageAmount, 
        en_plPlacement.pl_PositionVector, -en_vGravityDir);
      // prolongue breathing a bit, so not to come here every frame
      en_tmLastBreathed = tmNow-en_tmMaxHoldBreath+ctUp.ct_tmDrowningDamageDelay;
    }
  }
}

void CCecilMovableEntity::TestContentDamage(CContentType &ctDn, FLOAT fImmersion)
{
  // if the content can damage by swimming
  if (ctDn.ct_fSwimDamageAmount>0) {
    TIME tmNow = _pTimer->CurrentTick();
    // if there is a delay
    if (ctDn.ct_tmSwimDamageDelay>0) {
      // if not yet delayed
      if (tmNow-en_tmLastSwimDamage>ctDn.ct_tmSwimDamageDelay+_pTimer->TickQuantum) {
        // delay
        en_tmLastSwimDamage = tmNow+ctDn.ct_tmSwimDamageDelay;
        return;
      }
    }

    if (tmNow-en_tmLastSwimDamage>ctDn.ct_tmSwimDamageFrequency) {
      // inflict drowning damage 
      InflictDirectDamage(this, MiscDamageInflictor(),
        (DamageType)ctDn.ct_iSwimDamageType, ctDn.ct_fSwimDamageAmount*fImmersion, 
        en_plPlacement.pl_PositionVector, -en_vGravityDir);
      en_tmLastSwimDamage = tmNow;
    }
  }
  // if the content kills
  if (ctDn.ct_fKillImmersion>0 && fImmersion>=ctDn.ct_fKillImmersion
    &&(en_ulFlags&ENF_ALIVE)) {
    // inflict killing damage 
    InflictDirectDamage(this, MiscDamageInflictor(),
      (DamageType)ctDn.ct_iKillDamageType, GetHealth()*10.0f, 
      en_plPlacement.pl_PositionVector, -en_vGravityDir);
  }
}

void CCecilMovableEntity::TestSurfaceDamage(CSurfaceType &stDn)
{
  // if the surface can damage by walking
  if (stDn.st_fWalkDamageAmount>0) {
    TIME tmNow = _pTimer->CurrentTick();
    // if there is a delay
    if (stDn.st_tmWalkDamageDelay>0) {
      // if not yet delayed
      if (tmNow-en_tmLastSwimDamage>stDn.st_tmWalkDamageDelay+_pTimer->TickQuantum) {
        // delay
        en_tmLastSwimDamage = tmNow+stDn.st_tmWalkDamageDelay;
        return;
      }
    }

    if (tmNow-en_tmLastSwimDamage>stDn.st_tmWalkDamageFrequency) {
      // inflict walking damage 
      InflictDirectDamage(this, MiscDamageInflictor(),
        (DamageType)stDn.st_iWalkDamageType, stDn.st_fWalkDamageAmount, 
        en_plPlacement.pl_PositionVector, -en_vGravityDir);
      en_tmLastSwimDamage = tmNow;
    }
  }
}

// send touch event to this entity and touched entity
void CCecilMovableEntity::SendTouchEvent(const CCecilClipMove &cmMove)
{
  ETouch etouchThis;
  ETouch etouchOther;
  etouchThis.penOther = cmMove.cm_penHit;
  etouchThis.bThisMoved = FALSE;
  etouchThis.plCollision = cmMove.cm_plClippedPlane;
  etouchOther.penOther = this;
  etouchOther.bThisMoved = TRUE;
  etouchOther.plCollision = cmMove.cm_plClippedPlane;
  SendEvent(etouchThis);
  cmMove.cm_penHit->SendEvent(etouchOther);
}

// send block event to this entity
void CCecilMovableEntity::SendBlockEvent(CCecilClipMove &cmMove)
{
  EBlock eBlock;
  eBlock.penOther = cmMove.cm_penHit;
  eBlock.plCollision = cmMove.cm_plClippedPlane;
  SendEvent(eBlock);
}

BOOL CCecilMovableEntity::IsStandingOnPolygon(const SCollisionPolygon &cpo)
{
  // if cannot optimize for standing on handle
  if (en_pciCollisionInfo==NULL 
    ||!(en_pciCollisionInfo->ci_ulFlags&CIF_CANSTANDONHANDLE)) {
    // not standing on polygon
    return FALSE;
  }

  // [Cecil] Check brush polygons
  if (cpo.eType == SCollisionPolygon::POL_BRUSH) {
    // if polygon is not valid for standing on any more (brush turned off collision)
    if (cpo.pbpoHit->bpo_pbscSector->bsc_pbmBrushMip->bm_pbrBrush->br_penEntity->en_ulCollisionFlags==0) {
      // not standing on polygon
      return FALSE;
    }
  }

  const FLOATplane3D &plPolygon = cpo.plPolygon;
  // get stand-on handle
  FLOAT3D vHandle = en_plPlacement.pl_PositionVector;
  vHandle(1)+=en_pciCollisionInfo->ci_fHandleY*en_mRotation(1,2);
  vHandle(2)+=en_pciCollisionInfo->ci_fHandleY*en_mRotation(2,2);
  vHandle(3)+=en_pciCollisionInfo->ci_fHandleY*en_mRotation(3,2);
  vHandle-=((FLOAT3D&)plPolygon)*en_pciCollisionInfo->ci_fHandleR;

  // if handle is not on the plane
  if (plPolygon.PointDistance(vHandle)>0.01f) {
    // not standing on polygon
    return FALSE;
  }

  // [Cecil] Check if the point is inside the polygon
  return cpo.IsIntersecting(vHandle);
}

// check whether a polygon is below given point, but not too far away
BOOL CCecilMovableEntity::IsPolygonBelowPoint(const SCollisionPolygon &cpo, const FLOAT3D &vPoint, FLOAT fMaxDist)
{
  // [Cecil] Check brush polygons
  if (cpo.eType == SCollisionPolygon::POL_BRUSH) {
    // if passable or not allowed as ground
    if ((cpo.pbpoHit->bpo_ulFlags & BPOF_PASSABLE) || !AllowForGroundPolygon(cpo.pbpoHit)) {
      // it cannot be below
      return FALSE;
    }
  }

  // get polygon plane
  const FLOATplane3D &plPolygon = cpo.plPolygon;

  // determine polygon orientation relative to gravity
  FLOAT fCos = ((const FLOAT3D &)plPolygon)%en_vGravityDir;
  // if polygon is vertical or upside down
  if (fCos>-0.01f) {
    // it cannot be below
    return FALSE;
  }

  // if polygon's steepness is too high
  CSurfaceType &stReference = en_pwoWorld->wo_astSurfaceTypes[cpo.ubSurface];
  if (fCos>=-stReference.st_fClimbSlopeCos&&fCos<0
    ||stReference.st_ulFlags&STF_SLIDEDOWNSLOPE) {
    // it cannot be below
    return FALSE;
  }

  // get distance from point to the plane
  FLOAT fD = plPolygon.PointDistance(vPoint);
  // if the point is behind the plane
  if (fD<-0.01f) {
    // it cannot be below
    return FALSE;
  }

  // find distance of point from the polygon along gravity vector
  FLOAT fDistance = -fD/fCos;
  // if too far away
  if (fDistance > fMaxDist) {
    // it cannot be below
    return FALSE;
  }
  // project point to the polygon along gravity vector
  FLOAT3D vProjected = vPoint + en_vGravityDir*fDistance;

  // [Cecil] Check if the point is inside the polygon
  return cpo.IsIntersecting(vProjected);
}

// override this to make filtering for what can entity stand on
BOOL CCecilMovableEntity::AllowForGroundPolygon(CBrushPolygon *pbpo)
{
  return TRUE;
}

// check whether any cached near polygon is below given point
BOOL CCecilMovableEntity::IsSomeNearPolygonBelowPoint(const FLOAT3D &vPoint, FLOAT fMaxDist)
{
  // otherwise, there is none
  return FALSE;
}

// check whether any polygon in a sector is below given point
BOOL CCecilMovableEntity::IsSomeSectorPolygonBelowPoint(CBrushSector *pbsc, const FLOAT3D &vPoint, FLOAT fMaxDist)
{
  // for each polygon in the sector
  FOREACHINSTATICARRAY(pbsc->bsc_abpoPolygons, CBrushPolygon, itbpo) {
    CBrushPolygon *pbpo = itbpo;

    // [Cecil] Create collision polygon
    SCollisionPolygon cpo;
    cpo.SetBrushPolygon(pbpo);

    // if it is below
    if (IsPolygonBelowPoint(cpo, vPoint, fMaxDist)) {
      // there is some
      return TRUE;
    }
  }
  // otherwise, there is none
  return FALSE;
}

// check whether entity would fall if standing on next position
BOOL CCecilMovableEntity::WouldFallInNextPosition(void)
{
  // if entity doesn't care for falling
  if (en_fStepDnHeight<0) {
    // don't check
    return FALSE;
  }

  // [Cecil] Check collision polygon
  SCollisionPolygon cpoBelow;

  if (IsDerivedFromID(this, CPlayer_ClassID)) {
    CPlayer *penPlayer = (CPlayer *)this;
    cpoBelow = penPlayer->m_cpoStandOn;
    
  // if the stand-on polygon is near below
  } else if (en_pbpoStandOn != NULL) {
    cpoBelow.SetBrushPolygon(en_pbpoStandOn);
  }

  if (cpoBelow.bHit && IsPolygonBelowPoint(cpoBelow, en_vNextPosition, en_fStepDnHeight)) {
    // it won't fall
    return FALSE;
  }

  // make empty list of extra sectors to check
  CListHead lhActiveSectors;

  CStaticStackArray<CBrushPolygon *> &apbpo = en_apbpoNearPolygons;
  // for each cached near polygon
  for(INDEX iPolygon=0; iPolygon<apbpo.Count(); iPolygon++) {
    CBrushPolygon *pbpo = apbpo[iPolygon];
    cpoBelow.SetBrushPolygon(pbpo); // [Cecil]

    // if it is below
    if (IsPolygonBelowPoint(cpoBelow, en_vNextPosition, en_fStepDnHeight)) {
      // it won't fall
      lhActiveSectors.RemAll();
      return FALSE;
    }
    // if the polygon's sector is not added yet
    if (!pbpo->bpo_pbscSector->bsc_lnInActiveSectors.IsLinked()) {
      // add it
      lhActiveSectors.AddTail(pbpo->bpo_pbscSector->bsc_lnInActiveSectors);
    }
  }

  // NOTE: We add non-zoning reference first (if existing),
  // to speed up cases when standing on moving brushes.
  // if the reference is a non-zoning brush
  if (en_penReference!=NULL && en_penReference->en_RenderType==RT_BRUSH
    &&!(en_penReference->en_ulFlags&ENF_ZONING)
    && en_penReference->en_pbrBrush!=NULL) {
    // get first mip of the brush
    CBrushMip *pbmMip = en_penReference->en_pbrBrush->GetFirstMip();
    // for each sector in the brush mip
    FOREACHINDYNAMICARRAY(pbmMip->bm_abscSectors, CBrushSector, itbsc) {
      // if it is not added yet
      if (!itbsc->bsc_lnInActiveSectors.IsLinked()) {
        // add it
        lhActiveSectors.AddTail(itbsc->bsc_lnInActiveSectors);
      }
    }
  }

  // for each zoning sector that this entity is in
  {FOREACHSRCOFDST(en_rdSectors, CBrushSector, bsc_rsEntities, pbsc);
    // if it is not added yet
    if (!pbsc->bsc_lnInActiveSectors.IsLinked()) {
      // add it
      lhActiveSectors.AddTail(pbsc->bsc_lnInActiveSectors);
    }
  ENDFOR;}

  // for each active sector
  BOOL bSupportFound = FALSE;
  FOREACHINLIST(CBrushSector, bsc_lnInActiveSectors, lhActiveSectors, itbsc) {
    CBrushSector *pbsc = itbsc;
    // if the sector is zoning
    if (pbsc->bsc_pbmBrushMip->bm_pbrBrush->br_penEntity->en_ulFlags&ENF_ZONING) {
      // for non-zoning brush entities in the sector
      {FOREACHDSTOFSRC(pbsc->bsc_rsEntities, CEntity, en_rdSectors, pen);
        if (pen->en_RenderType==CEntity::RT_TERRAIN) {
          if (IsTerrainBelowPoint(pen->en_ptrTerrain, en_vNextPosition, en_fStepDnHeight, en_vGravityDir)) {
            bSupportFound = TRUE;
            goto out;
          }
          continue;
        }

        // [Cecil] Treat custom shaped collisions as valid standing surfaces, like terrains
        if ((en_ulPhysicsFlags & EPF_COLLIDEWITHCUSTOM)
          && (pen->en_RenderType == CEntity::RT_MODEL || pen->en_RenderType == CEntity::RT_EDITORMODEL
          || pen->en_RenderType == CEntity::RT_SKAMODEL || pen->en_RenderType == CEntity::RT_SKAEDITORMODEL))
        {
          BOOL bCustomCollision = TRUE;

          // Only exclusively against models marked with custom collision
          if (en_ulPhysicsFlags & EPF_COLLIDEWITHCUSTOM_EXCL) {
            bCustomCollision = !!(pen->GetPhysicsFlags() & EPF_CUSTOMCOLLISION);
          }

          if (bCustomCollision) {
            bSupportFound = TRUE;
            goto out;
          }
        }

        if (pen->en_RenderType!=CEntity::RT_BRUSH&&
            pen->en_RenderType!=CEntity::RT_FIELDBRUSH) {
          break;  // brushes are sorted first in list
        }
        // get first mip of the brush
        CBrushMip *pbmMip = pen->en_pbrBrush->GetFirstMip();
        // for each sector in the brush mip
        FOREACHINDYNAMICARRAY(pbmMip->bm_abscSectors, CBrushSector, itbscInMip) {
          // if it is not added yet
          if (!itbscInMip->bsc_lnInActiveSectors.IsLinked()) {
            // add it
            lhActiveSectors.AddTail(itbscInMip->bsc_lnInActiveSectors);
          }
        }
      ENDFOR;}
    }
    // if there is a polygon below in that sector
    if (IsSomeSectorPolygonBelowPoint(itbsc, en_vNextPosition, en_fStepDnHeight)) {
      // it won't fall
      bSupportFound = TRUE;
      break;
    }
  }
out:;

  // clear list of active sectors
  lhActiveSectors.RemAll();

  // if no support, it surely would fall
  return !bSupportFound;
}

// clear next position to current placement
void CCecilMovableEntity::ClearNextPosition(void)
{
  en_vNextPosition = en_plPlacement.pl_PositionVector;
  en_mNextRotation = en_mRotation;
}

// set current placement from next position
void CCecilMovableEntity::SetPlacementFromNextPosition(void)
{
  CPlacement3D plNew;
  plNew.pl_PositionVector = en_vNextPosition;
  DecomposeRotationMatrixNoSnap(plNew.pl_OrientationAngle, en_mNextRotation);
  FLOATmatrix3D mRotation;
  MakeRotationMatrixFast(mRotation, plNew.pl_OrientationAngle);
  SetPlacement_internal(plNew, mRotation, TRUE);
}

BOOL CCecilMovableEntity::TryToGoUpstairs(const FLOAT3D &vTranslationAbsolute, const CSurfaceType &stHit,
  BOOL bHitStairsOrg)
{
  // use only horizontal components of the movement
  FLOAT3D vTranslationHorizontal;
  GetNormalComponent(vTranslationAbsolute, en_vGravityDir, vTranslationHorizontal);

  // if the movement has no substantial value
  if(vTranslationHorizontal.Length()<0.001f) {
    // don't do it
    return FALSE;
  }
  FLOAT3D vTranslationHorizontalOrg = vTranslationHorizontal;
  // if the surface that is climbed on is not really stairs
  if (!bHitStairsOrg) {
    // keep minimum speed
    vTranslationHorizontal.Normalize();
    vTranslationHorizontal*=0.5f;
  }

  // remember original placement
  CPlacement3D plOriginal = en_plPlacement;

  // take stairs height
  FLOAT fStairsHeight = 0;
  if (stHit.st_fStairsHeight>0) {
    fStairsHeight = Max(stHit.st_fStairsHeight, en_fStepUpHeight);
  } else if (stHit.st_fStairsHeight<0) {
    fStairsHeight = Min(stHit.st_fStairsHeight, en_fStepUpHeight);
  }

  CContentType &ctDn = en_pwoWorld->wo_actContentTypes[en_iDnContent];
  CContentType &ctUp = en_pwoWorld->wo_actContentTypes[en_iUpContent];

  // if in partially in water
  BOOL bGettingOutOfWater = FALSE;
  if ((ctDn.ct_ulFlags&CTF_SWIMABLE) && !(ctUp.ct_ulFlags&CTF_SWIMABLE)
    && en_fImmersionFactor>0.3f) {
    // add immersion height to up step
    if (en_pciCollisionInfo!=NULL) {
      fStairsHeight=fStairsHeight*2+en_fImmersionFactor*
        (en_pciCollisionInfo->ci_fMaxHeight-en_pciCollisionInfo->ci_fMinHeight);
      // remember that we are trying to get out of water
      bGettingOutOfWater = TRUE;
    }
  }

  // calculate the 3 translation directions (up, forward and down)
  FLOAT3D avTranslation[3];
  avTranslation[0] = en_vGravityDir*-fStairsHeight;
  avTranslation[1] = vTranslationHorizontal;
  avTranslation[2] = en_vGravityDir*fStairsHeight;

  // for each translation step
  for(INDEX iStep=0; iStep<3; iStep++) {
    BOOL bStepOK = TRUE;
    // create new placement with the translation step
    en_vNextPosition = en_plPlacement.pl_PositionVector+avTranslation[iStep];
    en_mNextRotation = en_mRotation;
    // clip the movement to the entity's world
    CCecilClipMove cm(this);
    CecilClipMove(en_pwoWorld, cm);

    // if not passed
    if (cm.cm_fMovementFraction<1.0f) {
      // find hit surface
      INDEX iSurfaceHit = 0;
      BOOL bHitStairsNow = FALSE;

      // [Cecil]
      if (cm.cm_cpoHit.bHit) {
        bHitStairsNow = cm.cm_cpoHit.bStairs;
        iSurfaceHit = cm.cm_cpoHit.ubSurface;
      }
      CSurfaceType &stHit = en_pwoWorld->wo_astSurfaceTypes[iSurfaceHit];


      // check if hit a slope while climbing stairs
      const FLOAT3D &vHitPlane = cm.cm_plClippedPlane;
      FLOAT fPlaneDotG = vHitPlane%en_vGravityDir;
      FLOAT fPlaneDotGAbs = Abs(fPlaneDotG);

      BOOL bSlidingAllowed = (fPlaneDotGAbs>-0.01f && fPlaneDotGAbs<0.99f)&&bHitStairsOrg;

      BOOL bEarlyClipAllowed = 
        // going up or
        iStep==0 || 
        // going forward and hit stairs or
        iStep==1 && bHitStairsNow || 
        // going down and ends on something that is not high slope
        iStep==2 && 
          (vHitPlane%en_vGravityDir<-stHit.st_fClimbSlopeCos ||
            bHitStairsNow);

      // if early clip is allowed
      if (bEarlyClipAllowed || bSlidingAllowed) {
        // try to go to where it is clipped (little bit before)
        en_vNextPosition = en_plPlacement.pl_PositionVector +
          avTranslation[iStep]*(cm.cm_fMovementFraction*0.98f);
        if (bSlidingAllowed && iStep!=2) {
          FLOAT3D vSliding = cm.cm_plClippedPlane.ProjectDirection(
                avTranslation[iStep]*(1.0f-cm.cm_fMovementFraction))+
          vHitPlane*(ClampUp(avTranslation[iStep].Length(), 0.5f)/100.0f);
          en_vNextPosition += vSliding;
        }
        CCecilClipMove cm(this);
        CecilClipMove(en_pwoWorld, cm);
        // if it failed
        if (cm.cm_fMovementFraction<=1.0f) {
          // mark that this step is unsuccessful
          bStepOK = FALSE;
        }
      // if early clip is not allowed
      } else {
        // mark that this step is unsuccessful
        bStepOK = FALSE;
      }
    }

    // if the step is successful
    if (bStepOK) {
      // use that position
      SetPlacementFromNextPosition();
    // if the step failed
    } else {
      // restore original placement
      en_vNextPosition = plOriginal.pl_PositionVector;
      SetPlacementFromNextPosition();
      // move is unsuccessful
      return FALSE;
    }

  } // end of steps loop

  // all steps passed, use the final position

  // NOTE: must not keep the speed when getting out of water,
  // or the player gets launched out too fast
  if (!bGettingOutOfWater) {
    en_vAppliedTranslation += vTranslationHorizontalOrg;
  }
  // move is successful
  return TRUE;
}

/* Try to translate the entity. Slide, climb or push others if needed. */
BOOL CCecilMovableEntity::TryToMove(CCecilMovableEntity *penPusher, BOOL bTranslate, BOOL bRotate)
{
  // decrement the recursion counter
  if (penPusher!=NULL) {
    _ctTryToMoveCheckCounter--;
  } else {
    _ctTryToMoveCheckCounter-=4;
  }
  // if recursing too deep
  if (_ctTryToMoveCheckCounter<0) {
    // fail the move
    return FALSE;
  }

  // create new placement with movement
  if (bTranslate) {
    en_vNextPosition = en_plPlacement.pl_PositionVector+en_vMoveTranslation;
  } else {
    en_vNextPosition = en_plPlacement.pl_PositionVector;
  }
  if (bRotate) {
    en_mNextRotation = en_mMoveRotation*en_mRotation;
  } else {
    en_mNextRotation = en_mRotation;
  }

  // test if rotation can be ignored
  ULONG ulCIFlags = en_pciCollisionInfo->ci_ulFlags;
  BOOL bIgnoreRotation = !bRotate ||
    ((ulCIFlags&CIF_IGNOREROTATION)|| 
    ( (ulCIFlags&CIF_IGNOREHEADING) && 
      (en_mMoveRotation(1,2)==0&&en_mMoveRotation(2,2)==1&&en_mMoveRotation(3,2)==0) ));

  // create movement towards the new placement
  CCecilClipMove cmMove(this);
  // clip the movement to the entity's world
  if (!bTranslate && bIgnoreRotation) {
    cmMove.cm_fMovementFraction = 2.0f;
  } else {
    CecilClipMove(en_pwoWorld, cmMove);
  }

  // if the move passes
  if (cmMove.cm_fMovementFraction>1.0f) {
    // if entity is in walking control now, but it might fall of an edge
    if (bTranslate && en_penReference!=NULL && 
        (en_ulPhysicsFlags&EPF_TRANSLATEDBYGRAVITY) &&
        !(en_ulPhysicsFlags&(EPF_ONSTEEPSLOPE|EPF_ORIENTINGTOGRAVITY|EPF_FLOATING)) &&
        penPusher==NULL && WouldFallInNextPosition()) {
      // fail the movement
      SendEvent(EWouldFall());
      //CPrintF("  wouldfall\n");
      return FALSE;
    }
    // make entity use its new placement
    SetPlacementFromNextPosition();
    if (bTranslate) {
      en_vAppliedTranslation += en_vMoveTranslation;
    }
    if (bRotate) {
      en_mAppliedRotation = en_mMoveRotation*en_mAppliedRotation;
    }
    // move is successful
    return TRUE;

  // if the move is clipped
  } else {
    // if must not retry
    if (_ctTryToMoveCheckCounter<=0) {
      // fail
      return FALSE;
    }

    // if hit brush
    if (cmMove.cm_cpoHit.bHit) {
      // if polygon is stairs, and the entity can climb stairs
      if ((cmMove.cm_cpoHit.bStairs)
        &&((en_ulPhysicsFlags&EPF_ONBLOCK_MASK)==EPF_ONBLOCK_CLIMBORSLIDE)) {
        // adjust against sliding upwards
        cmMove.cm_plClippedPlane = FLOATplane3D(-en_vGravityDir, 0);
      }
      // if cannot be damaged by impact
      INDEX iSurface = cmMove.cm_cpoHit.ubSurface; // [Cecil]

      if (en_pwoWorld->wo_astSurfaceTypes[iSurface].st_ulFlags&STF_NOIMPACT) {
        // remember that
        en_ulPhysicsFlags|=EPF_NOIMPACTTHISTICK;
      }
    }

    // if entity is translated by gravity and 
    // the hit plane is more orthogonal to the gravity than the last one found
    if ((en_ulPhysicsFlags&EPF_TRANSLATEDBYGRAVITY) && !(en_ulPhysicsFlags&EPF_FLOATING)
      && (
      ((en_vGravityDir%(FLOAT3D&)cmMove.cm_plClippedPlane)
      <(en_vGravityDir%en_vReferencePlane)) ) ) {
      // remember touched entity as stand-on reference
      en_penReference = cmMove.cm_penHit;
//        CPrintF("    newreference id%08x\n", en_penReference->en_ulID);
      en_vReferencePlane = (FLOAT3D&)cmMove.cm_plClippedPlane;
      en_pbpoStandOn = cmMove.cm_cpoHit.pbpoHit;  // is NULL if not hit a brush

      // [Cecil]
      if (IsDerivedFromID(this, CPlayer_ClassID)) {
        CPlayer *penPlayer = (CPlayer *)this;
        penPlayer->m_cpoStandOn = cmMove.cm_cpoHit;
      }

      if (!cmMove.cm_cpoHit.bHit) {
        en_iReferenceSurface = 0;
      } else {
        en_iReferenceSurface = cmMove.cm_cpoHit.ubSurface; // [Cecil]
      }
    }

    // send touch event to this entity and to touched entity
    SendTouchEvent(cmMove);

    // if cannot be damaged by impact
    if (cmMove.cm_penHit->en_ulPhysicsFlags&EPF_NOIMPACT) {
      // remember that
      en_ulPhysicsFlags|=EPF_NOIMPACTTHISTICK;
    }

    // if entity bounces when blocked
    FLOAT3D vBounce;
    BOOL bBounce = FALSE;
    if ( ((en_ulPhysicsFlags&EPF_ONBLOCK_MASK)==EPF_ONBLOCK_BOUNCE) && bTranslate) {
      // create translation speed for bouncing off clipping plane
      FLOAT3D vParallel, vNormal;
      GetParallelAndNormalComponents(en_vMoveTranslation, cmMove.cm_plClippedPlane, 
        vNormal, vParallel);
      vNormal   *= -en_fBounceDampNormal;
      vParallel *= +en_fBounceDampParallel;
      vBounce = vNormal+vParallel;
      // if not too small bounce
      if (vNormal.Length()>0.1f) {
        // do bounce
        bBounce = TRUE;
      }
      // rotate slower
      en_aDesiredRotationRelative *= en_fBounceDampParallel;
      if (en_aDesiredRotationRelative.Length()<10) {
        en_aDesiredRotationRelative = ANGLE3D(0,0,0);
      }
    }
      
    // if entity pushes when blocked and the blocking entity is pushable
    if (penPusher!=NULL&&(cmMove.cm_penHit->en_ulPhysicsFlags&EPF_PUSHABLE)) {
      CCecilMovableModelEntity *penBlocking = ((CCecilMovableModelEntity *)cmMove.cm_penHit);
      // create push translation to account for rotating radius
      FLOAT3D vRadius = cmMove.cm_penHit->en_plPlacement.pl_PositionVector-
                                penPusher->en_plPlacement.pl_PositionVector;
      FLOAT3D vPush=(vRadius*penPusher->en_mMoveRotation-vRadius);
        //*(1.01f-cmMove.cm_fMovementFraction);
      vPush += penPusher->en_vMoveTranslation;
        //*(1.01f-cmMove.cm_fMovementFraction);

      penBlocking->en_vMoveTranslation = vPush;
      penBlocking->en_mMoveRotation = penPusher->en_mMoveRotation;

      // make sure it is added to the movers list
      penBlocking->AddToMoversDuringMoving();
      // push the blocking entity
      BOOL bUnblocked = penBlocking->TryToMove(penPusher, bTranslate, bRotate);
      // if it has removed itself
      if (bUnblocked) {
        // retry the movement
        ClearNextPosition();
        return TryToMove(penPusher, bTranslate, bRotate);
      } else {
        // move is unsuccessful
        SendBlockEvent(cmMove);
        ClearNextPosition();
        return FALSE;
      }
    // if entity slides if blocked
    } else if (
      ((en_ulPhysicsFlags&EPF_ONBLOCK_MASK)==EPF_ONBLOCK_SLIDE)||
      ((en_ulPhysicsFlags&EPF_ONBLOCK_MASK)==EPF_ONBLOCK_BOUNCE)||
      ((en_ulPhysicsFlags&EPF_ONBLOCK_MASK)==EPF_ONBLOCK_CLIMBORSLIDE)||
      ((en_ulPhysicsFlags&EPF_ONBLOCK_MASK)==EPF_ONBLOCK_STOPEXACT) ){

      // if translating
      if (bTranslate) {
  
        // create translation for sliding along clipping plane
        FLOAT3D vSliding;
        // if sliding along one plane
        if (_ctSliding==0) {
          // remember sliding parameters from the plane
          _vSlideOffDir = cmMove.cm_plClippedPlane;
          // get sliding velocity
          vSliding = cmMove.cm_plClippedPlane.ProjectDirection(
              en_vMoveTranslation*(1.0f-cmMove.cm_fMovementFraction));
          _ctSliding++;
        // if second plane
        } else if (_ctSliding==1) {
          // off direction is away from both planes
          _vSlideOffDir+=cmMove.cm_plClippedPlane;
          // sliding direction is along both planes
          _vSlideDir = _vSlideOffDir*(FLOAT3D&)cmMove.cm_plClippedPlane;
          if (_vSlideDir.Length()>0.001f) {
            _vSlideDir.Normalize();
          }
          _ctSliding++;
          // get sliding velocity
          GetParallelComponent(en_vMoveTranslation*(1.0f-cmMove.cm_fMovementFraction),
            _vSlideDir, vSliding);
        // if more than two planes
        } else {
          // off direction is away from all planes
          _vSlideOffDir+=cmMove.cm_plClippedPlane;
          // sliding direction is along all planes
          _vSlideDir = cmMove.cm_plClippedPlane.ProjectDirection(_vSlideDir);
          _ctSliding++;
          // get sliding velocity
          GetParallelComponent(en_vMoveTranslation*(1.0f-cmMove.cm_fMovementFraction),
            _vSlideDir, vSliding);
        }
        ASSERT(IsValidFloat(vSliding(1)));
        ASSERT(IsValidFloat(_vSlideDir(1)));
        ASSERT(IsValidFloat(_vSlideOffDir(1)));

        // if entity hit a brush polygon
        if (cmMove.cm_cpoHit.bHit) {
          CSurfaceType &stHit = en_pwoWorld->wo_astSurfaceTypes[cmMove.cm_cpoHit.ubSurface]; // [Cecil]

          // if it is not beeing pushed, and it can climb stairs
          if (penPusher==NULL
            &&(en_ulPhysicsFlags&EPF_ONBLOCK_MASK)==EPF_ONBLOCK_CLIMBORSLIDE) {
            // NOTE: originally, the polygon's plane was considered here.
            // due to sphere-polygon collision algo, it is possible for the collision
            // plane to be even orthogonal to the polygon plane.
            // considering polygon's plane prevented climbing up the stairs.
            // so now, the collision plane is considered.
            // if there are any further problems, i recommend choosing
            // the plane that is more orthogonal to the movement direction.
            FLOAT3D &vHitPlane = (FLOAT3D&)cmMove.cm_plClippedPlane;//cmMove.cm_pbpoHit->bpo_pbplPlane->bpl_plAbsolute;
            BOOL bHitStairs = cmMove.cm_cpoHit.bStairs; // [Cecil]
            // if the plane hit is steep enough to climb on it 
            // (cannot climb low slopes as if those were stairs)
            if ((vHitPlane%en_vGravityDir>-stHit.st_fClimbSlopeCos)
              ||bHitStairs) {
              // if sliding along it would be mostly horizontal 
              // (i.e. cannot climb up the slope)
              FLOAT fSlidingVertical2 = en_vMoveTranslation%en_vGravityDir;
              fSlidingVertical2*=fSlidingVertical2;
              FLOAT fSliding2 = en_vMoveTranslation%en_vMoveTranslation;
              if ((2*fSlidingVertical2<=fSliding2)
              // if can go upstairs
                && TryToGoUpstairs(en_vMoveTranslation, stHit, bHitStairs)) {
                // movement is ok
                return FALSE;
              }
            }
          }
        }

        // entity shouldn't really slide
        if ((en_ulPhysicsFlags&EPF_ONBLOCK_MASK)==EPF_ONBLOCK_STOPEXACT) {
          // kill sliding
          vSliding = FLOAT3D(0,0,0);
        }

        ASSERT(IsValidFloat(vSliding(1)));

        // add a component perpendicular to the sliding plane
        vSliding += _vSlideOffDir*
          (ClampUp(en_vMoveTranslation.Length(), 0.5f)/100.0f);

        // if initial movement has some substantial value
        if(en_vMoveTranslation.Length()>0.001f && cmMove.cm_fMovementFraction>0.002f) {
          // go to where it is clipped (little bit before)
          vSliding += en_vMoveTranslation*(cmMove.cm_fMovementFraction*0.985f);
        }

        // ignore extremely small sliding
        if (vSliding.ManhattanNorm()<0.001f) {
          return FALSE;
        }

        // recurse
        en_vMoveTranslation = vSliding;
        ClearNextPosition();
        TryToMove(penPusher, bTranslate, bRotate);
        // if bouncer
        if (bBounce) {
          // remember bouncing speed for next tick
          en_vAppliedTranslation = vBounce;
          // no reference while bouncing
          en_penReference = NULL;
          en_vReferencePlane = FLOAT3D(0.0f, 0.0f, 0.0f);
          en_iReferenceSurface = 0;
        }

        // move is not entirely successful
        return FALSE;

      // if rotating
      } else if (bRotate) {
        // if bouncing entity
        if ((en_ulPhysicsFlags&EPF_ONBLOCK_MASK)==EPF_ONBLOCK_BOUNCE) {
          // rotate slower
          en_aDesiredRotationRelative *= en_fBounceDampParallel;
          if (en_aDesiredRotationRelative.Length()<10) {
            en_aDesiredRotationRelative = ANGLE3D(0,0,0);
          }
          // move is not successful
          return FALSE;
        }
        // create movement getting away from the collision point
        en_vMoveTranslation = cmMove.cm_vClippedLine*-1.2f;
        // recurse
        ClearNextPosition();
        TryToMove(penPusher, TRUE, bRotate);
        // move is not entirely successful
        return FALSE;
      }
      // not translating and not rotating? -  move is unsuccessful
      return FALSE;

    // if entity has some other behaviour when blocked
    } else {
      // move is unsuccessful (EPF_ONBLOCK_STOP is assumed)
      SendBlockEvent(cmMove);
      ClearNextPosition();
      return FALSE;
    }
  }
}

// clear eventual temporary variables that are not persistent
void CCecilMovableEntity::ClearMovingTemp(void)
{
//    return;
//    CLEARMEM(en_vIntendedTranslation);
//    CLEARMEM(en_mIntendedRotation);
  ClearNextPosition();
  CLEARMEM(en_vMoveTranslation);
  CLEARMEM(en_mMoveRotation);
  CLEARMEM(en_vAppliedTranslation);
  CLEARMEM(en_mAppliedRotation);
}

// [Cecil] Pre-moving logic with an additional rotation direction variable (for EPF_ROTATETOPLANE)
void CCecilMovableEntity::PreMoving(FLOAT3D &vRotationDir)
{
  if (en_pciCollisionInfo==NULL) {
    return;
  }

  // remember old placement for lerping
  en_plLastPlacement = en_plPlacement;

  // for each child of the mover
  {FOREACHINLIST(CEntity, en_lnInParent, en_lhChildren, itenChild) {
    // if the child is movable, yet not in movers list
    if ((itenChild->en_ulPhysicsFlags&EPF_MOVABLE)
      &&!((CCecilMovableEntity*)&*itenChild)->en_lnInMovers.IsLinked()) {
      CCecilMovableEntity *penChild = ((CCecilMovableEntity*)&*itenChild);
      // remember old placement for lerping
      penChild->en_plLastPlacement = penChild->en_plPlacement;  
    }
  }}

  FLOAT fTickQuantum=_pTimer->TickQuantum; // used for normalizing from SI units to game ticks

  // NOTE: this limits maximum velocity of any entity in game.
  // it is absolutely neccessary in order to prevent extreme slowdowns in physics.
  // if you plan to increase this one radically, consider decreasing 
  // collision grid cell size!
  // currently limited to a bit less than speed of sound (not that it is any specificaly
  // relevant constant, but it is just handy)
  const FLOAT fMaxSpeed = 300.0f;

  // [Cecil] Instead of limiting each axis, limit overall speed
  const FLOAT fCurrentSpeed = en_vCurrentTranslationAbsolute.Length();

  if (fCurrentSpeed > fMaxSpeed) {
    en_vCurrentTranslationAbsolute /= fCurrentSpeed;
    en_vCurrentTranslationAbsolute *= fMaxSpeed;
  }

  // if the entity is a model
  if (en_RenderType==RT_MODEL || en_RenderType==RT_EDITORMODEL ||
      en_RenderType==RT_SKAMODEL || en_RenderType==RT_SKAEDITORMODEL) {
    // test for field containment
    TestFields(en_iUpContent, en_iDnContent, en_fImmersionFactor);

    // [Cecil] Set to gravity direction by default
    vRotationDir = en_vGravityDir;

    // [Cecil] Rotate the entity towards the plane below it
    if (en_ulPhysicsFlags & EPF_ROTATETOPLANE) {
      FLOAT3D vPoint;
      FLOATplane3D plPlane;
      FLOAT fDistanceToEdge;
      CBrushPolygon *pbpo = GetNearestPolygon(vPoint, plPlane, fDistanceToEdge);

      // If it's closer than 2 meters
      if (pbpo != NULL && (vPoint - GetPlacement().pl_PositionVector).Length() <= 2.0f) {
        // Calculate angles of the current gravity and the plane
        FLOAT3D vNewDir = -(FLOAT3D &)plPlane;
        ANGLE3D aSource, aDest;
        DirectionVectorToAnglesNoSnap(en_vGravityDir, aSource);
        DirectionVectorToAnglesNoSnap(vNewDir, aDest);

        // Find angle difference
        aDest -= aSource;
        aDest(1) = NormalizeAngle(aDest(1));
        aDest(2) = NormalizeAngle(aDest(2));
        aDest(3) = NormalizeAngle(aDest(3));

        // Set plane vector only if the difference is small enough
        if (Abs(aDest(2)) < 46.0f && Abs(aDest(3)) < 46.0f) {
          vRotationDir = vNewDir;
        }
      }
    }

    // if entity has sticky feet
    if (en_ulPhysicsFlags & EPF_STICKYFEET) {
      // find gravity towards nearest polygon
      FLOAT3D vPoint;
      FLOATplane3D plPlane;
      FLOAT fDistanceToEdge;
      if (GetNearestPolygon(vPoint, plPlane, fDistanceToEdge)) {
        en_vGravityDir = -(FLOAT3D&)plPlane;
        vRotationDir = en_vGravityDir; // [Cecil] Rotate towards the plane
      }
    }
  }
  CContentType &ctDn = en_pwoWorld->wo_actContentTypes[en_iDnContent];
  CContentType &ctUp = en_pwoWorld->wo_actContentTypes[en_iUpContent];

  // test entity breathing
  TestBreathing(ctUp);
  // test content damage
  TestContentDamage(ctDn, en_fImmersionFactor);
  // test surface damage
  if (en_penReference!=NULL) {
    CSurfaceType &stReference = en_pwoWorld->wo_astSurfaceTypes[en_iReferenceSurface];
    TestSurfaceDamage(stReference);
  }
   
  // calculate content fluid factors
  FLOAT fBouyancy = (1-
    (ctDn.ct_fDensity/en_fDensity)*en_fImmersionFactor-
    (ctUp.ct_fDensity/en_fDensity)*(1-en_fImmersionFactor));
  FLOAT fSpeedModifier = 
    ctDn.ct_fSpeedMultiplier*en_fImmersionFactor+
    ctUp.ct_fSpeedMultiplier*(1-en_fImmersionFactor);
  FLOAT fFluidFriction =
    ctDn.ct_fFluidFriction*en_fImmersionFactor+
    ctUp.ct_fFluidFriction*(1-en_fImmersionFactor);
  FLOAT fControlMultiplier =
    ctDn.ct_fControlMultiplier*en_fImmersionFactor+
    ctUp.ct_fControlMultiplier*(1-en_fImmersionFactor);

  // transform relative desired translation into absolute
  FLOAT3D vDesiredTranslationAbsolute = en_vDesiredTranslationRelative;
  // relative absolute
  if (!(en_ulPhysicsFlags & EPF_ABSOLUTETRANSLATE)) {
    vDesiredTranslationAbsolute *= en_mRotation;
  }
  // transform translation and rotation into tick time units
  vDesiredTranslationAbsolute*=fTickQuantum;
  ANGLE3D aRotationRelative;
  aRotationRelative(1) = en_aDesiredRotationRelative(1)*fTickQuantum;
  aRotationRelative(2) = en_aDesiredRotationRelative(2)*fTickQuantum;
  aRotationRelative(3) = en_aDesiredRotationRelative(3)*fTickQuantum;
  // make absolute matrix rotation from relative angle rotation
  FLOATmatrix3D mRotationAbsolute;

  if ((en_ulPhysicsFlags&EPF_ONBLOCK_MASK)==EPF_ONBLOCK_PUSH) {
    FLOATmatrix3D mNewRotation;
    MakeRotationMatrixFast(mNewRotation, en_plPlacement.pl_OrientationAngle+aRotationRelative);
    mRotationAbsolute = mNewRotation*!en_mRotation;

  } else {
    MakeRotationMatrixFast(mRotationAbsolute, aRotationRelative);
    mRotationAbsolute = en_mRotation*(mRotationAbsolute*!en_mRotation);
  }

  // modify desired speed for fluid parameters
  vDesiredTranslationAbsolute*=fSpeedModifier;

  // remember jumping strength (if any)
  FLOAT fJump = -en_mRotation.GetColumn(2)%vDesiredTranslationAbsolute;

  BOOL bReferenceMovingInY = FALSE;
  BOOL bReferenceRotatingNonY = FALSE;
  // if we have a CCecilMovableEntity for a reference entity
  if (en_penReference!=NULL && (en_penReference->en_ulPhysicsFlags&EPF_MOVABLE)) {
    CCecilMovableEntity *penReference = (CCecilMovableEntity *)(CEntity*)en_penReference;
    // get reference deltas for this tick
    //const FLOAT3D &vReferenceTranslation = penReference->en_vIntendedTranslation;
    //const FLOATmatrix3D &mReferenceRotation = penReference->en_mIntendedRotation;

    // [Cecil] Use direct speeds instead of intended ones above
    FLOAT3D vReferenceTranslation = penReference->en_vCurrentTranslationAbsolute * _pTimer->TickQuantum;
    FLOATmatrix3D mReferenceRotation;
    MakeRotationMatrix(mReferenceRotation, penReference->en_aCurrentRotationAbsolute * _pTimer->TickQuantum);

    // calculate radius of this entity relative to reference
    FLOAT3D vRadius = en_plPlacement.pl_PositionVector
        -penReference->en_plPlacement.pl_PositionVector;
    FLOAT3D vReferenceDelta = vReferenceTranslation + vRadius*mReferenceRotation - vRadius;
    // add the deltas to this entity
    vDesiredTranslationAbsolute += vReferenceDelta;
    mRotationAbsolute = mReferenceRotation*mRotationAbsolute;

    // remember if reference is moving in y
    bReferenceMovingInY = (vReferenceDelta%en_vGravityDir != 0.0f);
    bReferenceRotatingNonY = ((en_vGravityDir*mReferenceRotation)%en_vGravityDir)>0.01f;
  }

  FLOAT3D vTranslationAbsolute = en_vCurrentTranslationAbsolute*fTickQuantum;

  // initially not orienting
  en_ulPhysicsFlags&=~EPF_ORIENTINGTOGRAVITY;
  // if the entity is rotated by gravity
  if (en_ulPhysicsFlags&EPF_ORIENTEDBYGRAVITY) {
    // find entity's down vector
    FLOAT3D vDown;
    vDown(1) = -en_mRotation(1,2);
    vDown(2) = -en_mRotation(2,2);
    vDown(3) = -en_mRotation(3,2);

    // [Cecil] Select vector for rotating towards a plane
    FLOAT3D vDirTowardsPlane = (en_ulPhysicsFlags & EPF_ROTATETOPLANE) ? vRotationDir : en_vGravityDir;

    // find angle entities down and gravity down
    FLOAT fCos = vDown % vDirTowardsPlane; // [Cecil]
    // if substantial
    if (fCos<0.99999f) {
      // mark
      en_ulPhysicsFlags|=EPF_ORIENTINGTOGRAVITY;

      // limit the angle rotation
      ANGLE a = ACos(fCos);
      if (Abs(a)>20) {
        a = 20*Sgn(a);
      }
      FLOAT fRad =RadAngle(a);

      // make rotation axis
      FLOAT3D vAxis = vDown * vDirTowardsPlane; // [Cecil]
      FLOAT fLen = vAxis.Length();
      if (fLen<0.01f) {
        vAxis(1) = en_mRotation(1,3);
        vAxis(2) = en_mRotation(2,3);
        vAxis(3) = en_mRotation(3,3);
      // NOTE: must have this patch for smooth rocking on moving brushes
      // (should infact do fRad/=fLen always)
      } else if (!bReferenceRotatingNonY) {
        fRad/=fLen;
      }
      vAxis*=fRad;

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
  en_ulPhysicsFlags&=~EPF_FLOATING;

  FLOAT ACC=en_fAcceleration*fTickQuantum*fTickQuantum;
  FLOAT DEC=en_fDeceleration*fTickQuantum*fTickQuantum;
  // if the entity is not affected by gravity
  if (!(en_ulPhysicsFlags&EPF_TRANSLATEDBYGRAVITY)) {
    // accellerate towards desired absolute translation
    if (en_ulPhysicsFlags&EPF_NOACCELERATION) {
      vTranslationAbsolute = vDesiredTranslationAbsolute;
    } else {
      AddAcceleration(vTranslationAbsolute, vDesiredTranslationAbsolute, 
        ACC*fControlMultiplier,
        DEC*fControlMultiplier);
    }
  // if swimming
  } else if ((fBouyancy*en_fGravityA<0.5f && (ctDn.ct_ulFlags&(CTF_SWIMABLE|CTF_FLYABLE)))) {
    // mark that
    en_ulPhysicsFlags|=EPF_FLOATING;
    // accellerate towards desired absolute translation
    if (en_ulPhysicsFlags&EPF_NOACCELERATION) {
      vTranslationAbsolute = vDesiredTranslationAbsolute;
    } else {
      AddAcceleration(vTranslationAbsolute, vDesiredTranslationAbsolute, 
        ACC*fControlMultiplier,
        DEC*fControlMultiplier);
    }

    // add gravity acceleration
    if (fBouyancy<-0.1f) {
      FLOAT fGV=en_fGravityV*fTickQuantum*fSpeedModifier;
      FLOAT fGA=(en_fGravityA*-fBouyancy)*fTickQuantum*fTickQuantum;
      AddAcceleration(vTranslationAbsolute, en_vGravityDir*-fGV, fGA, fGA);
    } else if (fBouyancy>+0.1f) {
      FLOAT fGV=en_fGravityV*fTickQuantum*fSpeedModifier;
      FLOAT fGA=(en_fGravityA*fBouyancy)*fTickQuantum*fTickQuantum;
      AddAcceleration(vTranslationAbsolute, en_vGravityDir*fGV, fGA, fGA);
    }

  // if the entity is affected by gravity
  } else {
    BOOL bGravityAlongPolygon = TRUE;

    // [Cecil] Check collision polygon
    SCollisionPolygon cpoStanding;

    if (IsDerivedFromID(this, CPlayer_ClassID)) {
      CPlayer *penPlayer = (CPlayer *)this;
      cpoStanding = penPlayer->m_cpoStandOn;

    // if the stand-on polygon is near below
    } else if (en_pbpoStandOn != NULL) {
      cpoStanding.SetBrushPolygon(en_pbpoStandOn);
    }

    // if there is no fixed remembered stand-on polygon or the entity is not on it anymore
    if (!cpoStanding.bHit || !IsStandingOnPolygon(cpoStanding) || bReferenceMovingInY
      || (en_ulPhysicsFlags&EPF_ORIENTINGTOGRAVITY)) {
      // clear the stand on polygon
      en_pbpoStandOn = NULL;

      // [Cecil]
      if (IsDerivedFromID(this, CPlayer_ClassID)) {
        CPlayer *penPlayer = (CPlayer *)this;
        penPlayer->m_cpoStandOn.Reset();
      }

      if (en_penReference == NULL || bReferenceMovingInY) {
        bGravityAlongPolygon = FALSE;
      }
    }

    // if gravity can cause the entity to fall
    if (!bGravityAlongPolygon) {
      // add gravity acceleration
      FLOAT fGV=en_fGravityV*fTickQuantum*fSpeedModifier;
      FLOAT fGA=(en_fGravityA*fBouyancy)*fTickQuantum*fTickQuantum;
      AddGAcceleration(vTranslationAbsolute, en_vGravityDir, fGA, fGV);
    // if entity can only slide down its stand-on polygon
    } else {
      // disassemble gravity to parts parallel and normal to plane
      FLOAT3D vPolygonDir = -en_vReferencePlane;
      // NOTE: normal to plane=paralel to plane normal vector!
      FLOAT3D vGParallel, vGNormal;
      GetParallelAndNormalComponents(en_vGravityDir, vPolygonDir, vGNormal, vGParallel);
      // add gravity part parallel to plane
      FLOAT fFactor = vGParallel.Length();

      if (fFactor>0.001f) {
        FLOAT fGV=en_fGravityV*fTickQuantum*fSpeedModifier;
        FLOAT fGA=(en_fGravityA*fBouyancy)*fTickQuantum*fTickQuantum;
        AddGAcceleration(vTranslationAbsolute, vGParallel/fFactor, fGA*fFactor, fGV*fFactor);
      }

      // kill your normal-to-polygon speed if towards polygon and small
      FLOAT fPolyGA = (vPolygonDir%en_vGravityDir)*en_fGravityA;
      FLOAT fYSpeed = vPolygonDir%vTranslationAbsolute;
      if (fYSpeed>0 && fYSpeed < fPolyGA) {
        vTranslationAbsolute -= vPolygonDir*fYSpeed;
      }

      // if a bouncer
      if ((en_ulPhysicsFlags&EPF_ONBLOCK_MASK)==EPF_ONBLOCK_BOUNCE) {
        // rotate slower
        en_aDesiredRotationRelative *= en_fJumpControlMultiplier;
        if (en_aDesiredRotationRelative.Length()<10) {
          en_aDesiredRotationRelative = ANGLE3D(0,0,0);
        }
      }
    }

    CSurfaceType &stReference = en_pwoWorld->wo_astSurfaceTypes[en_iReferenceSurface];

    // [Cecil] Separate variable for checking if there has been enough time since last significant movement for jumping
    const BOOL bAllowedToJump = (_pTimer->CurrentTick() > en_tmLastSignificantVerticalMovement + 0.25f);

    // if it has a reference entity
    if (en_penReference!=NULL) {
      FLOAT fPlaneY = (en_vGravityDir%en_vReferencePlane);
      FLOAT fPlaneYAbs = Abs(fPlaneY);
      FLOAT fFriction = stReference.st_fFriction;

      // if on a steep slope
      if (fPlaneY>=-stReference.st_fClimbSlopeCos&&fPlaneY<0
        ||(stReference.st_ulFlags&STF_SLIDEDOWNSLOPE)&&fPlaneY>-0.99f) {
        en_ulPhysicsFlags|=EPF_ONSTEEPSLOPE;

        // accellerate horizontaly towards desired absolute translation
        AddAccelerationOnPlane2(
          vTranslationAbsolute, 
          vDesiredTranslationAbsolute,
          ACC*fPlaneYAbs*fPlaneYAbs*fFriction*fControlMultiplier,
          DEC*fPlaneYAbs*fPlaneYAbs*fFriction*fControlMultiplier,
          en_vReferencePlane,
          en_vGravityDir);

      // if not on a steep slope
      } else {
        en_ulPhysicsFlags&=~EPF_ONSTEEPSLOPE;
        // accellerate on plane towards desired absolute translation
        AddAccelerationOnPlane(
          vTranslationAbsolute, 
          vDesiredTranslationAbsolute,
          ACC*fPlaneYAbs*fPlaneYAbs*fFriction*fControlMultiplier,
          DEC*fPlaneYAbs*fPlaneYAbs*fFriction*fControlMultiplier,
          en_vReferencePlane);
      }

      const BOOL bCanJumpFromSlope = (fPlaneY < -stReference.st_fJumpSlopeCos);

      // if wants to jump and can jump
      if (fJump < -0.01f && (bCanJumpFromSlope || bAllowedToJump)) {
        vTranslationAbsolute += en_vGravityDir * fJump;
        en_tmJumped = _pTimer->CurrentTick();
        en_pbpoStandOn = NULL;

        // [Cecil]
        if (IsDerivedFromID(this, CPlayer_ClassID)) {
          CPlayer *penPlayer = (CPlayer *)this;
          penPlayer->m_cpoStandOn.Reset();
        }
      }

    // if it doesn't have a reference entity
    } else {
      // [Cecil] Infinite air control, if negative
      // if can control after jump
      if (en_tmMaxJumpControl < 0.0f || _pTimer->CurrentTick() - en_tmJumped < en_tmMaxJumpControl) {
        // accellerate horizontaly, but slower
        AddAccelerationOnPlane(
          vTranslationAbsolute, 
          vDesiredTranslationAbsolute,
          ACC*fControlMultiplier*en_fJumpControlMultiplier,
          DEC*fControlMultiplier*en_fJumpControlMultiplier,
          FLOATplane3D(en_vGravityDir, 0));
      }

      // if wants to jump and can jump
      if (fJump < -0.01f && bAllowedToJump) {
        vTranslationAbsolute += en_vGravityDir * fJump;
        en_tmJumped = _pTimer->CurrentTick();
        en_pbpoStandOn = NULL;

        // [Cecil]
        if (IsDerivedFromID(this, CPlayer_ClassID)) {
          CPlayer *penPlayer = (CPlayer *)this;
          penPlayer->m_cpoStandOn.Reset();
        }
      }
    }
  }

  // check for force-field acceleration
  // NOTE: pulled out because of a bug in VC code generator, see function comments above
  CheckAndAddGAcceleration(this, vTranslationAbsolute, fTickQuantum);

  // if there is fluid friction involved
  if (fFluidFriction>0.01f) {
    // slow down
    AddAcceleration(vTranslationAbsolute, FLOAT3D(0.0f, 0.0f, 0.0f),
      0.0f, DEC*fFluidFriction);
  }

  // if may slow down spinning
  if ( (en_ulPhysicsFlags& EPF_CANFADESPINNING) &&
    ( (ctDn.ct_ulFlags&CTF_FADESPINNING) || (ctUp.ct_ulFlags&CTF_FADESPINNING) ) ) {
    // reduce desired rotation
    en_aDesiredRotationRelative *= (1-fSpeedModifier*0.05f);
    if (en_aDesiredRotationRelative.Length()<10) {
      en_aDesiredRotationRelative = ANGLE3D(0,0,0);
    }
  }

  // [Cecil]
  BOOL bStandOn = (en_pbpoStandOn != NULL);

  if (IsDerivedFromID(this, CPlayer_ClassID)) {
    CPlayer *penPlayer = (CPlayer *)this;
    bStandOn = penPlayer->m_cpoStandOn.bHit;
  }

  // discard reference entity (will be recalculated)
  if (!bStandOn && (vTranslationAbsolute.ManhattanNorm()>1E-5f || 
    en_vReferencePlane%en_vGravityDir<0.0f)) {
    en_penReference = NULL;
    en_vReferencePlane = FLOAT3D(0.0f, 0.0f, 0.0f);
    en_iReferenceSurface = 0;
  }

  en_vIntendedTranslation = vTranslationAbsolute;
  en_mIntendedRotation = mRotationAbsolute;

  //-- estimate future movements for collision caching

  // make box of the entity for its current rotation
  FLOATaabbox3D box;
  en_pciCollisionInfo->MakeBoxAtPlacement(FLOAT3D(0,0,0), en_mRotation, box);
  // if it is a light source
  {CLightSource *pls = GetLightSource();
  if (pls!=NULL && !(pls->ls_ulFlags&LSF_LENSFLAREONLY)) {
    // expand the box to be sure that it contains light range
    ASSERT(!(pls->ls_ulFlags&LSF_DIRECTIONAL));
    box |= FLOATaabbox3D(FLOAT3D(0,0,0), pls->ls_rFallOff);
  }}
  // add a bit around it
  static CSymbolPtr pfCacheAround("phy_fCollisionCacheAround");
  box.ExpandByFactor(pfCacheAround.GetFloat() - 1.0f);
  // make box go few ticks ahead of the entity
  box += en_plPlacement.pl_PositionVector;
  en_boxMovingEstimate  = box;
  static CSymbolPtr pfCacheAhead("phy_fCollisionCacheAhead");
  box += en_vIntendedTranslation * pfCacheAhead.GetFloat();
  en_boxMovingEstimate |= box;

  // clear applied movement to be updated during movement
  en_vAppliedTranslation = FLOAT3D(0.0f, 0.0f, 0.0f);
  en_mAppliedRotation.Diagonal(1.0f);
}

/* Calculate physics for moving. */
void CCecilMovableEntity::DoMoving(void)
{
  if (en_pciCollisionInfo == NULL || (en_ulPhysicsFlags & EPF_FORCEADDED)) {
    return;
  }

  // if rotation and translation are synchronized
  if (en_ulPhysicsFlags & EPF_RT_SYNCHRONIZED) {
    // move both in translation and rotation
    en_vMoveTranslation = en_vIntendedTranslation-en_vAppliedTranslation;
    en_mMoveRotation = en_mIntendedRotation*!en_mAppliedRotation;

    InitTryToMove();

    CCecilMovableEntity *penPusher = NULL;

    if ((en_ulPhysicsFlags&EPF_ONBLOCK_MASK)==EPF_ONBLOCK_PUSH) {
      penPusher = this;
    }

    BOOL bMoveSuccessfull = TryToMove(penPusher, TRUE, TRUE);

  // if rotation and translation are asynchronious
  } else {
    ASSERT((en_ulPhysicsFlags&EPF_ONBLOCK_MASK)!=EPF_ONBLOCK_PUSH);

    // if there is no reference
    if (en_penReference == NULL) {
      // try to do simple move both in translation and rotation
      en_vMoveTranslation = en_vIntendedTranslation-en_vAppliedTranslation;
      en_mMoveRotation = en_mIntendedRotation*!en_mAppliedRotation;
      InitTryToMove();
      _ctTryToMoveCheckCounter = 4; // no retries
      BOOL bMoveSuccessfull = TryToMove(NULL, TRUE, TRUE);
      // if it passes
      if (bMoveSuccessfull) {
        // finish
        return;
      }
    }

    // translate
    en_vMoveTranslation = en_vIntendedTranslation - en_vAppliedTranslation;

    InitTryToMove();
    TryToMove(NULL, TRUE, FALSE);

    // rotate
    en_mMoveRotation = en_mIntendedRotation * !en_mAppliedRotation;

    if (en_mMoveRotation(1, 1) != 1 || en_mMoveRotation(1, 2) != 0 || en_mMoveRotation(1, 3) != 0
     || en_mMoveRotation(2, 1) != 0 || en_mMoveRotation(2, 2) != 1 || en_mMoveRotation(2, 3) != 0
     || en_mMoveRotation(3, 1) != 0 || en_mMoveRotation(3, 2) != 0 || en_mMoveRotation(3, 3) != 1) {
      InitTryToMove();
      TryToMove(NULL, FALSE, TRUE);
    }
  }
}

// calculate consequences of moving/not moving in this tick
void CCecilMovableEntity::PostMoving(void) 
{
  if (en_pciCollisionInfo==NULL) {
    // mark for removing from list of movers
    en_ulFlags |= ENF_INRENDERING;
    return;
  }

  if (en_ulPhysicsFlags & EPF_FORCEADDED) {
    en_ulPhysicsFlags &= ~EPF_FORCEADDED;
    return;
  }

  // remember valid reference if valid
  if (en_penReference != NULL) en_penLastValidReference = en_penReference;

  // remember original translation
  FLOAT3D vOldTranslation = en_vCurrentTranslationAbsolute;

  // calculate current velocity from movements applied in this tick
  en_vCurrentTranslationAbsolute = en_vAppliedTranslation / _pTimer->TickQuantum;

  // remember significant movements
  if (Abs(en_vCurrentTranslationAbsolute % en_vGravityDir) > 0.1f) {
    en_tmLastSignificantVerticalMovement = _pTimer->CurrentTick();
  }

  ClearNextPosition();

  // calculate speed change between needed and possible (in m/s)
  FLOAT3D vSpeedDelta = en_vIntendedTranslation - en_vAppliedTranslation;
  FLOAT fSpeedDelta = vSpeedDelta.Length() / _pTimer->TickQuantum;

  // if it is large change and can be damaged by impact
  if (fSpeedDelta>en_fCollisionSpeedLimit &&
      !(en_ulPhysicsFlags&EPF_NOIMPACTTHISTICK)) {
    // inflict impact damage 
    FLOAT fDamage = ((fSpeedDelta-en_fCollisionSpeedLimit)/en_fCollisionSpeedLimit)*en_fCollisionDamageFactor;
    InflictDirectDamage(this, MiscDamageInflictor(), DMT_IMPACT, fDamage, 
      en_plPlacement.pl_PositionVector, -vSpeedDelta.Normalize());
  }

  en_ulPhysicsFlags &= ~EPF_NOIMPACTTHISTICK;

  // remember old speed for Touch reactions
  en_vIntendedTranslation = vOldTranslation;

  // if not moving anymore
  if (en_vCurrentTranslationAbsolute.ManhattanNorm() < 0.001f
   && (en_vDesiredTranslationRelative.ManhattanNorm() == 0 || en_fAcceleration == 0)
   && en_aDesiredRotationRelative.ManhattanNorm() == 0)
  {
    // if there is a reference
    if (en_penReference != NULL) {
      // it the reference is movable
      if (en_penReference->en_ulPhysicsFlags & EPF_MOVABLE) {
        CCecilMovableEntity *penReference = (CCecilMovableEntity *)&*en_penReference;

        // if the reference is not in the list of movers
        if (!penReference->en_lnInMovers.IsLinked()) {
          // mark for removing from list of movers
          en_ulFlags |= ENF_INRENDERING;
        }

      // if the reference is not movable
      } else {
        // mark for removing from list of movers
        en_ulFlags |= ENF_INRENDERING;
      }

    // if there is no reference
    } else {
      // if no gravity and no forces can affect this entity
      if (!(en_ulPhysicsFlags & (EPF_TRANSLATEDBYGRAVITY | EPF_ORIENTEDBYGRAVITY))
         || en_fGravityA == 0.0f) { // !!!! test for forces also when implemented
        // mark for removing from list of movers
        en_ulFlags |= ENF_INRENDERING;
      }
    }

    // if should remove from movers list
    if (en_ulFlags & ENF_INRENDERING) {
      // clear last placement
      en_plLastPlacement = en_plPlacement;
    }
  }

  // remember new position for particles
  if (en_plpLastPositions != NULL) en_plpLastPositions->AddPosition(en_vNextPosition);

  // [Cecil] _bPredictionActive is unavailable, so recalculate it in place
  static CSymbolPtr pbPrediction("cli_bPrediction");
  static CSymbolPtr pbPredictIfServer("cli_bPredictIfServer");
  static CSymbolPtr pfPredictionFilter("cli_fPredictionFilter");
  BOOL _bPredictionActive = pbPrediction.GetIndex() && (pbPredictIfServer.GetIndex() || !_pNetwork->IsServer());

  // if should filter predictions
  if (_bPredictionActive && (IsPredictable() || IsPredictor())) {
    CCecilMovableEntity *penTail = (CCecilMovableEntity *)GetPredictedSafe(this);
    TIME tmNow = _pTimer->CurrentTick();
 
    if (penTail->en_tmLastPredictionHead<-1) {
      penTail->en_vLastHead = en_plPlacement.pl_PositionVector;
      penTail->en_vPredError = FLOAT3D(0,0,0);
      penTail->en_vPredErrorLast = FLOAT3D(0,0,0);
    }

    // if this is a predictor
    if (IsPredictor()) {
      // if a new prediction of old prediction head, or just started prediction
      if (penTail->en_tmLastPredictionHead==tmNow || penTail->en_tmLastPredictionHead<0) {
        // remember error
        penTail->en_vPredErrorLast = penTail->en_vPredError;
        penTail->en_vPredError += 
          en_plPlacement.pl_PositionVector-penTail->en_vLastHead;
        // remember last head
        penTail->en_vLastHead = en_plPlacement.pl_PositionVector;
        // if this is really head of prediction chain
        if (IsPredictionHead()) {
          // remember the time
          penTail->en_tmLastPredictionHead = tmNow;
        }

      // if newer than last prediction head
      } else if (tmNow>penTail->en_tmLastPredictionHead) {
        // just remember head and time
        penTail->en_vLastHead = en_plPlacement.pl_PositionVector;
        penTail->en_tmLastPredictionHead = tmNow;
      }

    // if prediction is of for this entity
    } else if (!(en_ulFlags&ENF_WILLBEPREDICTED)) {
      // if it was on before
      if (penTail->en_tmLastPredictionHead>0) {
        // remember error
        penTail->en_vPredErrorLast = penTail->en_vPredError;
        penTail->en_vPredError += 
          en_plPlacement.pl_PositionVector-penTail->en_vLastHead;
      }
      // remember this as head
      penTail->en_vLastHead = en_plPlacement.pl_PositionVector;
      penTail->en_tmLastPredictionHead = -1;
    }
    // if this is head of chain
    if (IsPredictionHead()) {
      // fade error
      penTail->en_vPredErrorLast = penTail->en_vPredError;
      penTail->en_vPredError *= pfPredictionFilter.GetFloat();
    }
  }
};

// call this if you move without collision
void CCecilMovableEntity::CacheNearPolygons(void)  {
  CCecilClipMove cm(this);
  cm.CacheNearPolygons();
};
