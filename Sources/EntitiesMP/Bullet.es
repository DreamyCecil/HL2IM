502
%{
#include "StdH.h"

// [Cecil]
#include "EntitiesMP/EnemyBase.h"
#include "EntitiesMP/Mod/Sound3D.h"
#include "EntitiesMP/Cecil/Effects.h"

// [Cecil] For class IDs
#include "EntitiesMP/Mod/BetaEnemies/Antlion.h"
#include "EntitiesMP/Mod/BetaEnemies/AntlionGuard.h"
#include "EntitiesMP/Mod/BetaEnemies/Headcrab.h"
#include "EntitiesMP/Beast.h"
#include "EntitiesMP/Gizmo.h"

#define CECILSOUND_TAG 321
%}

uses "EntitiesMP/BasicEffects";
uses "Engine/Classes/MovableEntity";

// input parameters for bullet
event EBulletInit {
  CEntityPointer penOwner, // who launched it
  FLOAT fDamage,           // damage
};

%{
void CBullet_OnPrecache(CDLLEntityClass *pdec, INDEX iUser) {
  pdec->PrecacheClass(CLASS_BASIC_EFFECT, BET_BULLETHOLE);
  pdec->PrecacheClass(CLASS_BASIC_EFFECT, BET_BLOODSPILL);
  pdec->PrecacheClass(CLASS_BASIC_EFFECT, BET_BULLETTRAIL);

  // [Cecil]
  pdec->PrecacheClass(CLASS_BASIC_EFFECT, BET_BULLET_WATERWAVE);
}
%}

class export CBullet : CEntity {
name      "Bullet";
thumbnail "";
features "ImplementsOnPrecache";

properties:
  1 CEntityPointer m_penOwner,        // entity which owns it
  2 FLOAT m_fDamage = 0.0f,                   // damage
  3 FLOAT3D m_vTarget = FLOAT3D(0,0,0),       // bullet target point in space
  4 FLOAT3D m_vTargetCopy = FLOAT3D(0,0,0),   // copy of bullet target point in space for jitter
  6 FLOAT3D m_vHitPoint = FLOAT3D(0,0,0),     // hit point
  8 INDEX m_iBullet = 0,                // bullet for lerped launch
  9 enum DamageType m_EdtDamage = DMT_BULLET,   // damage type
 10 FLOAT m_fBulletSize = 0.0f,      // bullet can have radius, for hitting models only

components:
  1 class CLASS_BASIC_EFFECT "Classes\\BasicEffect.ecl",

  // [Cecil] Sound
  5 class CLASS_SOUND3D "Classes\\Sound3D.ecl",

functions:

/************************************************************
 *                      BULLET LAUNCH                       *
 ************************************************************/
  // set bullet damage
  void SetDamage(FLOAT fDamage) {
    m_fDamage = fDamage;
  };

  // calc jitter target
  void CalcTarget(FLOAT fRange) {
    // destination in bullet direction
    AnglesToDirectionVector(GetPlacement().pl_OrientationAngle, m_vTarget);
    m_vTarget *= fRange;
    m_vTarget += GetPlacement().pl_PositionVector;
    m_vTargetCopy = m_vTarget;
  };

  void CalcTarget(CEntity *pen, FLOAT fRange) {
    FLOAT3D vTarget;

    // target body
    EntityInfo *peiTarget = (EntityInfo*) (pen->GetEntityInfo());
    GetEntityInfoPosition(pen, peiTarget->vTargetCenter, vTarget);

    // calculate
    m_vTarget = (vTarget - GetPlacement().pl_PositionVector).Normalize();
    m_vTarget *= fRange;
    m_vTarget += GetPlacement().pl_PositionVector;
    m_vTargetCopy = m_vTarget;
  };

  // [Cecil] Target with the offset
  void CalcTarget(CEntity *pen, const FLOAT3D &vOffset, FLOAT fRange) {
    FLOAT3D vTarget;

    // target body
    EntityInfo *peiTarget = (EntityInfo*) (pen->GetEntityInfo());
    GetEntityInfoPosition(pen, peiTarget->vTargetCenter, vTarget);

    // [Cecil] Add offset
    vTarget += vOffset;

    // calculate
    m_vTarget = (vTarget - GetPlacement().pl_PositionVector).Normalize();
    m_vTarget *= fRange;
    m_vTarget += GetPlacement().pl_PositionVector;
    m_vTargetCopy = m_vTarget;
  };

  // calc jitter target - !!! must call CalcTarget first !!!
  void CalcJitterTarget(FLOAT fR) {
    FLOAT3D vJitter;

    // comp graphics algorithms sphere
    FLOAT fZ = FRnd()*2.0f - 1.0f;
    FLOAT fA = FRnd()*360.0f;
    FLOAT fT = Sqrt(1-(fZ*fZ));
    vJitter(1) = fT * CosFast(fA);
    vJitter(2) = fT * SinFast(fA);
    vJitter(3) = fZ;
    vJitter = vJitter*fR*FRnd();

    // target
    m_vTarget = m_vTargetCopy + vJitter;
  };

  // calc jitter target asymetric - !!! must call CalcTarget first !!!
  void CalcJitterTargetFixed(FLOAT fX, FLOAT fY, FLOAT fJitter) {
    FLOAT fRndX = FRnd()*2.0f - 1.0f;
    FLOAT fRndY = FRnd()*2.0f - 1.0f;
    FLOAT3D vX, vY;
    const FLOATmatrix3D &m=GetRotationMatrix();
    vX(1) = m(1,1); vX(2) = m(2,1); vX(3) = m(3,1);
    vY(1) = m(1,2); vY(2) = m(2,2); vY(3) = m(3,2);
    // target
    m_vTarget = m_vTargetCopy + (vX*(fX+fRndX*fJitter)) + (vY*(fY+fRndY*fJitter));
  };

  // launch one bullet
  void LaunchBullet(BOOL bSound, BOOL bTrail, BOOL bHitFX) {
    // cast a ray to find bullet target
    CCecilCastRay crRay( m_penOwner, GetPlacement().pl_PositionVector, m_vTarget);
    crRay.cr_bHitPortals = TRUE;
    crRay.cr_bHitTranslucentPortals = TRUE;
    crRay.cr_ttHitModels = CCecilCastRay::TT_CUSTOM;
    crRay.cr_bPhysical = FALSE;
    crRay.cr_fTestR = m_fBulletSize;
    FLOAT3D vHitDirection;
    AnglesToDirectionVector(GetPlacement().pl_OrientationAngle, vHitDirection);

    // [Cecil] Entity to play the impact sound for
    CEntity *penImpactSoundFor = NULL;

    INDEX ctCasts = 0;
    while (ctCasts < 10) {
      if (ctCasts == 0) {
        // perform first cast
        crRay.Cast(GetWorld());
      } else {
        // next casts
        crRay.ContinueCast(GetWorld());
      }
      ctCasts++;

      // stop casting if nothing hit
      if (crRay.cr_penHit == NULL) {
        break;
      }

      // apply damage
      const FLOAT fDamageMul = GetSeriousDamageMultiplier(m_penOwner);
      InflictDirectDamage(crRay.cr_penHit, m_penOwner, m_EdtDamage, m_fDamage*fDamageMul, crRay.cr_vHit, vHitDirection);

      m_vHitPoint = crRay.cr_vHit;

      // [Cecil] Spawn a bullet hole at the hit polygon
      if (crRay.cr_cpoPolygon.bHit)
      {
        FLOAT3D vHitNormal = FLOAT3D(crRay.cr_cpoPolygon.plPolygon);

        // Obtain surface type
        const INDEX iSurfaceType = crRay.cr_cpoPolygon.ubSurface;
        BulletHitType bhtType = (BulletHitType)GetBulletHitTypeForSurface(iSurfaceType);

        BOOL bPassable = FALSE;

        // If hit an actual brush polygon
        const BOOL bHitBrush = (crRay.cr_cpoPolygon.eType == SCollisionPolygon::POL_BRUSH);

        if (bHitBrush) {
          // Get content type
          CBrushPolygon *pbpo = crRay.cr_cpoPolygon.pbpoHit;

          const INDEX iContent = pbpo->bpo_pbscSector->GetContentType();
          const CContentType &ct = GetWorld()->wo_actContentTypes[iContent];

          // If this is an underwater polygon
          if (ct.ct_ulFlags & CTF_BREATHABLE_GILLS) {
            // And we hit a water surface
            if (iSurfaceType == SURFACE_WATER) {
              vHitNormal = -vHitNormal;
              bhtType = BHT_BRUSH_WATER;

            // And we hit stone underwater
            } else {
              bhtType = BHT_BRUSH_UNDER_WATER;
            }
          }

          // Determine if the polygon can be shot through
          bPassable = pbpo->bpo_ulFlags & (BPOF_PASSABLE | BPOF_SHOOTTHRU);
        }

        // Spawn hit effect
        if (!bPassable || iSurfaceType == SURFACE_WATER) {
          // [Cecil]
          SSpawnHitEffectArgs args;
          args.pen = this;
          args.bhtType = bhtType;
          args.bSound = bSound;
          args.vHitNormal = vHitNormal;
          args.vHitPoint = crRay.cr_vHit;
          args.vHitDirection = vHitDirection;

          // [Cecil] Parent to non-brush entities immediately
          if (!bHitBrush) {
            args.penParent = crRay.cr_penHit;
          }

          SpawnHitTypeEffect(args);
        }

        // Hit something, no need to continue
        if (!bPassable) {
          break;
        }
      }

      // if not brush
      if (crRay.cr_penHit->GetRenderType() != RT_BRUSH) {
        // [Cecil] Remember hit entity
        penImpactSoundFor = crRay.cr_penHit;

        // if flesh entity
        if (crRay.cr_penHit->GetEntityInfo() != NULL) {
          if (((EntityInfo*)crRay.cr_penHit->GetEntityInfo())->Eeibt == EIBT_FLESH) {
            CEntity *penOfFlesh = crRay.cr_penHit;
            FLOAT3D vHitNormal = (GetPlacement().pl_PositionVector-m_vTarget).Normalize();
            FLOAT3D vOldHitPos = crRay.cr_vHit;
            FLOAT3D vDistance;

            // look behind the entity (for back-stains)
            crRay.ContinueCast(GetWorld());
            if (crRay.cr_penHit != NULL && crRay.cr_cpoPolygon.bHit
             && crRay.cr_penHit->GetRenderType() == RT_BRUSH) {
              vDistance = crRay.cr_vHit-vOldHitPos;
              vHitNormal = FLOAT3D(crRay.cr_cpoPolygon.plPolygon);

            } else {
              vDistance = FLOAT3D(0.0f, 0.0f, 0.0f);
              vHitNormal = FLOAT3D(0, 0, 0);
            }

            // [Cecil]
            SSpawnHitEffectArgs args;
            args.pen = this;
            args.bSound = bSound;
            args.vHitNormal = vHitNormal;
            args.vHitPoint = crRay.cr_vHit;
            args.vHitDirection = vHitDirection;
            args.vDistance = vDistance;

            // spawn red blood hit spill effect
            args.bhtType = BHT_FLESH;

            // [Cecil] NOTE: Don't use IsOfClassID() here because enemy replacements have the same IDs as vanilla enemies!
            // [Cecil] HL2 enemies
            if (IsOfClass(penOfFlesh, "Antlion") || IsOfClass(penOfFlesh, "AntlionGuard") || IsOfClass(penOfFlesh, "Headcrab")) {
              args.bhtType = BHT_GOO;

            } else if (IsOfClass(penOfFlesh, "Gizmo") || IsOfClass(penOfFlesh, "Beast")) {
              // spawn green blood hit spill effect
              args.bhtType = BHT_ACID;
            }

            SpawnHitTypeEffect(args);
            break;
          }
        }

        // stop casting ray if not brush
        break;
      }
    }

    // [Cecil] Impact sound
    if (penImpactSoundFor != NULL) {
      SprayParticlesType sptType = SPT_NONE;

      if (IsDerivedFromID(penImpactSoundFor, CEnemyBase_ClassID)) {
        sptType = ((CEnemyBase &)*penImpactSoundFor).m_sptType;

      } else if (IsOfClassID(penImpactSoundFor, CModelHolder2_ClassID)) {
        CModelDestruction *penDestruction = ((CModelHolder2 &)*penImpactSoundFor).GetDestruction();

        if (penDestruction != NULL) {
          sptType = penDestruction->m_sptType;
        }

      } else if (IS_PLAYER(penImpactSoundFor)) {
        sptType = SPT_BLOOD;
      }

      if (sptType != SPT_NONE) {
        INDEX iImpactSound = 0;

        {FOREACHINDYNAMICCONTAINER(GetWorld()->wo_cenEntities, CEntity, iten) {
          CEntity *penCheck = iten;

          // Too many sounds
          if (iImpactSound >= 4) { break; }

          // Not a sound
          if (!IsOfClassID(penCheck, CCecilSound3D_ClassID)) { continue; }

          // Close enough with the right tag
          if (((CCecilSound3D &)*penCheck).m_iTag == CECILSOUND_TAG && DistanceTo(penImpactSoundFor, penCheck) < 12.0f) {
            iImpactSound++;
          }
        }}

        // Can play up to 4 sounds at once
        if (iImpactSound < 4) {
          CCecilSound3D *penSound = (CCecilSound3D *)&*CreateEntity(penImpactSoundFor->GetPlacement(), CLASS_SOUND3D);

          penSound->m_fnSound = SprayParticlesSound(penImpactSoundFor, sptType);
          penSound->m_iFlags = SOF_3D|SOF_VOLUMETRIC;
          penSound->m_iTag = CECILSOUND_TAG;
          penSound->SetParameters(50.0f, 5.0f, 1.0f, 1.0f);
          penSound->Initialize();
        }
      }
    }

    if (bTrail) {
      SpawnTrail();
    }
  };

  // destroy yourself
  void DestroyBullet(void) {
    Destroy();
  };

/************************************************************
 *                        EFFECTS                           *
 ************************************************************/
  // spawn trail of this bullet
  void SpawnTrail(void) {
    // get bullet path positions
    const FLOAT3D &v0 = GetPlacement().pl_PositionVector;
    const FLOAT3D &v1 = m_vHitPoint;
    // calculate distance
    FLOAT3D vD = v1-v0;
    FLOAT fD = vD.Length();
    // if too short
    if (fD < 1.0f) {
      // no trail
      return;
    }

    // length must be such that it doesn't get out of path
    FLOAT fLen = Min(20.0f, fD);
    // position is random, but it must not make trail go out of path
    FLOAT3D vPos;

    if (fLen<fD) {
      vPos = Lerp(v0, v1, FRnd()*(fD-fLen)/fD);
    } else {
      vPos = v0;
    }

    ESpawnEffect ese;
    UBYTE ubRndH = UBYTE( 8+FRnd()*32);
    UBYTE ubRndS = UBYTE( 8+FRnd()*32);
    UBYTE ubRndV = UBYTE( 224+FRnd()*32);
    UBYTE ubRndA = UBYTE( 32+FRnd()*128);
    ese.colMuliplier = HSVToColor(ubRndH, ubRndS, ubRndV)|ubRndA;
    ese.betType = BET_BULLETTRAIL;
    ese.vNormal = vD/fD;
    ese.vStretch = FLOAT3D(0.1f, fLen, 1.0f);

    // spawn effect
    FLOAT3D vBulletIncommingDirection;
    vBulletIncommingDirection = (m_vTarget-GetPlacement().pl_PositionVector).Normalize();
    CPlacement3D plHit = CPlacement3D(vPos-vBulletIncommingDirection * 0.1f, GetPlacement().pl_OrientationAngle);
    CEntityPointer penHit = CreateEntity(plHit, CLASS_BASIC_EFFECT);
    penHit->Initialize(ese);
  };

procedures:
  Main(EBulletInit eInit) {
    // remember the initial parameters
    ASSERT(eInit.penOwner != NULL);
    m_penOwner = eInit.penOwner;
    m_fDamage = eInit.fDamage;

    InitAsVoid();
    SetPhysicsFlags(EPF_MODEL_IMMATERIAL);
    SetCollisionFlags(ECF_IMMATERIAL);

    // for lerped launch
    m_iBullet = 0;
    return;
  };
};