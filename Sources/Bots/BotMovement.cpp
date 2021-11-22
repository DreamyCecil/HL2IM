/* Copyright (c) 2018-2021 Dreamy Cecil
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

// [Cecil] 2021-06-14: This file is for functions primarily used by PlayerBot class
#include "StdH.h"

#include "BotFunctions.h"
#include "BotMovement.h"

// Shortcuts
#define SBS    (pen->m_sbsBot)
#define WEAPON (pen->GetPlayerWeapons())
#define WORLD  (_pNetwork->ga_World)
#define THOUGHT(_String) (pen->m_btThoughts.Push(_String))

// [Cecil] 2021-06-25: Too long since the last position change
BOOL NoPosChange(CPlayerBot *pen) {
  if (_pTimer->CurrentTick() - pen->m_tmPosChange > 1.0f) {
    pen->m_tmPosChange = _pTimer->CurrentTick();
    return TRUE;
  }
  return FALSE;
};

// [Cecil] 2021-06-14: Try to find some path
void BotPathFinding(CPlayerBot *pen, SBotLogic &sbl) {
  if (_pNavmesh->bnm_cbppPoints.Count() <= 0) {
    return;
  }

  const FLOAT3D &vBotPos = pen->GetPlacement().pl_PositionVector;

  CEntity *penTarget = NULL;
  BOOL bSeeTarget = FALSE;

  // go to the player
  if (sbl.Following()) {
    // if can't see them
    if (!sbl.SeePlayer()) {
      penTarget = pen->m_penFollow;
      bSeeTarget = TRUE;
    }

  // go to the item
  } else if (sbl.ItemExists()) {
    penTarget = pen->m_penFollow;
    bSeeTarget = TRUE;

  // go to the enemy
  } else {
    penTarget = pen->m_penTarget;
    bSeeTarget = sbl.SeeEnemy();
  }

  if (!sbl.Following()) {
    // select important points sometimes
    if (!pen->m_bImportantPoint && pen->m_tmPickImportant <= _pTimer->CurrentTick()) {
      // compare chance
      if (SBS.fImportantChance > 0.0f && pen->FRnd() <= SBS.fImportantChance) {
        CBotPathPoint *pbppImportant = _pNavmesh->FindImportantPoint(pen, -1);

        if (pbppImportant != NULL) {
          pen->m_pbppTarget = pbppImportant;
          pen->m_bImportantPoint = TRUE;
          THOUGHT(CTString(0, "New important point: ^caf3f3f%d", pbppImportant->bpp_iIndex));
        }
      }

      pen->m_tmPickImportant = _pTimer->CurrentTick() + 5.0f;
    }
  }

  if (penTarget == NULL) {
    pen->m_pbppCurrent = NULL;
    pen->m_ulPointFlags = 0;
    return;
  }

  BOOL bReachedImportantPoint = FALSE;

  // only change the important point if reached it
  if (pen->m_bImportantPoint) {
    if (pen->m_pbppTarget != NULL) {
      // position difference
      FLOAT3D vPointDiff = (pen->m_pbppTarget->bpp_vPos - vBotPos);
      
      // close to the point
      bReachedImportantPoint = (vPointDiff.Length() < pen->m_pbppTarget->bpp_fRange);

    // lost target point
    } else {
      pen->m_bImportantPoint = FALSE;
    }

    // if reached the important point
    if (bReachedImportantPoint) {
      // use important entity
      UseImportantEntity(pen, pen->m_pbppTarget->bpp_penImportant);

      // reset important point
      if (pen->m_pbppTarget->bpp_pbppNext == NULL) {
        pen->m_bImportantPoint = FALSE;
        THOUGHT("^caf3f3fReached important point");

      // proceed to the next important point
      } else {
        pen->m_pbppTarget = pen->m_pbppTarget->bpp_pbppNext;
        THOUGHT("^c3f3fafNext important point");
      }
    }
  }

  // able to select new target point
  BOOL bChangeTargetPoint = (pen->m_pbppCurrent == NULL || pen->m_tmChangePath <= _pTimer->CurrentTick() || NoPosChange(pen));
  CBotPathPoint *pbppReached = NULL;

  // if timer is up and there's a point
  if (!bChangeTargetPoint) {
    // position difference
    FLOAT3D vPointDiff = (pen->m_pbppCurrent->bpp_vPos - vBotPos);

    // close to the point
    FLOAT &fRange = pen->m_pbppCurrent->bpp_fRange;
    bChangeTargetPoint = (vPointDiff.Length() < fRange);

    // a bit higher up
    vPointDiff = (pen->m_pbppCurrent->bpp_vPos - vBotPos) - pen->en_vGravityDir * (fRange * 0.5f);
    bChangeTargetPoint |= (vPointDiff.Length() < fRange);

    // reached this point
    if (bChangeTargetPoint) {
      pbppReached = pen->m_pbppCurrent;
    }
  }

  if (bChangeTargetPoint) { 
    // find first point to go to
    CBotPathPoint *pbppClosest = NearestNavMeshPointBot(pen, FALSE);

    // can see the enemy or don't have any point yet
    BOOL bSelectTarget = (bSeeTarget || pen->m_pbppCurrent == NULL);

    // if not following the important point, select new one if possible
    if (!pen->m_bImportantPoint && bSelectTarget) {
      CMovableEntity *penMovableTarget = (penTarget->GetPhysicsFlags() & EPF_MOVABLE ? (CMovableEntity *)penTarget : NULL);
      pen->m_pbppTarget = NearestNavMeshPointPos(penMovableTarget, penTarget->GetPlacement().pl_PositionVector);
    }

    CTString strThought; // [Cecil] TEMP

    // [Cecil] 2021-06-21: Just go to the first point if haven't reached it yet
    if (pbppReached != pbppClosest) {
      pen->m_pbppCurrent = pbppClosest;
      pen->m_ulPointFlags = pbppClosest->bpp_ulFlags;
      
      FLOAT3D vToPoint = (pbppClosest->bpp_vPos - vBotPos).SafeNormalize();
      ANGLE3D aToPoint; DirectionVectorToAngles(vToPoint, aToPoint);
      strThought.PrintF("Closest point ^c00ff00%d ^c00af00[%.1f, %.1f]",
                        pbppClosest->bpp_iIndex, aToPoint(1), aToPoint(2));

    // pick the next point on the path
    } else {
      CBotPathPoint *pbppNext = _pNavmesh->FindNextPoint(pbppClosest, pen->m_pbppTarget);

      // remember the point if found
      if (pbppNext != NULL) {
        // [Cecil] 2021-06-16: Target point is unreachable, stay where you are
        pen->m_pbppCurrent = (pbppNext->bpp_ulFlags & PPF_UNREACHABLE) ? pbppClosest : pbppNext;

        // get flags of the closest point or override them
        pen->m_ulPointFlags = (pbppNext->bpp_ulFlags & PPF_OVERRIDE) ? pbppNext->bpp_ulFlags : pbppClosest->bpp_ulFlags;

        FLOAT3D vToPoint = (pbppNext->bpp_vPos - vBotPos).SafeNormalize();
        ANGLE3D aToPoint; DirectionVectorToAngles(vToPoint, aToPoint);
        strThought.PrintF("Next point ^c00ff00%d ^c00af00[%.1f, %.1f]",
                          pbppNext->bpp_iIndex, aToPoint(1), aToPoint(2));

      // no next point
      } else {
        pen->m_pbppCurrent = NULL;
        pen->m_ulPointFlags = 0;
      }
    }

    if (pen->m_pbppCurrent != NULL) {
      THOUGHT(strThought);
    }

    pen->m_tmChangePath = _pTimer->CurrentTick() + 5.0f;
  }
};

// [Cecil] 2021-06-15: Set bot aim
void BotAim(CPlayerBot *pen, CPlayerAction &pa, SBotLogic &sbl) {
  // [Cecil] 2021-06-16: Aim in the walking direction on a path if haven't seen the enemy in a while
  if (pen->m_pbppCurrent != NULL && _pTimer->CurrentTick() - pen->m_tmLastSawTarget > 2.0f)
  {
    // running speed
    FLOAT3D vRunDir = HorizontalDiff(pen->en_vCurrentTranslationAbsolute, pen->en_vGravityDir);

    // relative position
    CPlacement3D plToDir(pen->en_vCurrentTranslationAbsolute, sbl.ViewAng());

    // angle towards the target (negate pitch)
    FLOAT2D vToTarget = FLOAT2D(GetRelH(plToDir), -sbl.ViewAng()(2));
    FLOAT fPitch = GetRelP(plToDir);

    // look down after some time
    if (pen->m_fFallTime > 1.0f && fPitch < 0.0f) {
      vToTarget(2) = fPitch;
    }

    // set rotation speed
    if (vRunDir.Length() >= 2.0f) {
      sbl.aAim(1) = Clamp(vToTarget(1) * 0.3f, -30.0f, 30.0f) / _pTimer->TickQuantum;
    }
    sbl.aAim(2) = Clamp(vToTarget(2) * 0.3f, -30.0f, 30.0f) / _pTimer->TickQuantum;

    return;
  }

  // no enemy
  if (!sbl.EnemyExists()) {
    return;
  }

  EntityInfo *peiTarget = (EntityInfo *)pen->m_penTarget->GetEntityInfo();
  FLOAT3D vEnemy;

  // get target center position
  if (peiTarget != NULL) {
    GetEntityInfoPosition(pen->m_penTarget, peiTarget->vTargetCenter, vEnemy);

  // just enemy position if no entity info
  } else {
    vEnemy = pen->m_penTarget->GetPlacement().pl_PositionVector + FLOAT3D(0.0f, 1.0f, 0.0f) * pen->m_penTarget->GetRotationMatrix();
  }

  // current weapon
  SBotWeaponConfig &bw = sbl.aWeapons[pen->m_iBotWeapon];

  // next position prediction
  vEnemy += ((CMovableEntity*)&*pen->m_penTarget)->en_vCurrentTranslationAbsolute
          * (SBS.fPrediction + pen->FRnd() * SBS.fPredictRnd) // default: *= 0.2f
          * (1.0f - bw.bw_fAccuracy); // [Cecil] 2021-06-20: Prediction based on accuracy

  // look a bit higher if it's a player
  if (IS_PLAYER(pen->m_penTarget)) {
    vEnemy += FLOAT3D(0, 0.25f, 0) * pen->m_penTarget->GetRotationMatrix();
  }

  // relative position
  CPlacement3D plToTarget = sbl.plBotView;
  plToTarget.pl_PositionVector = vEnemy - plToTarget.pl_PositionVector;

  // angle towards the target
  FLOAT2D vToTarget = FLOAT2D(GetRelH(plToTarget), GetRelP(plToTarget));

  // update accuracy angles
  if (SBS.fAccuracyAngle > 0.0f) {
    FLOAT tmNow = _pTimer->CurrentTick();
        
    // randomize every half a second
    if (pen->m_tmBotAccuracy <= tmNow) {
      // more accurate with the sniper
      FLOAT fAccuracyMul = (UsingScope(pen) ? 0.2f : 1.0f) * SBS.fAccuracyAngle;

      // invisible targets are hard to aim at
      if (pen->m_penTarget->GetFlags() & ENF_INVISIBLE) {
        fAccuracyMul *= 3.0f;
      }

      pen->m_vAccuracy = FLOAT3D(pen->FRnd() - 0.5f, pen->FRnd() - 0.5f, 0.0f) * fAccuracyMul;
      pen->m_tmBotAccuracy = tmNow + 0.5f;
    }

    vToTarget(1) += pen->m_vAccuracy(1);
    vToTarget(2) += pen->m_vAccuracy(2);
  }
      
  // limit to one tick, otherwise aim will go too far and miss
  const FLOAT fDistRotSpeed = ClampDn(SBS.fRotSpeedDist, 0.05f);      // 400
  const FLOAT fMinRotSpeed = ClampDn(SBS.fRotSpeedMin, 0.05f);        // 0.05
  const FLOAT fMaxRotSpeed = ClampDn(SBS.fRotSpeedMax, fMinRotSpeed); // 0.2
  const FLOAT fSpeedLimit = SBS.fRotSpeedLimit;                       // 30

  // clamp the speed
  FLOAT fRotationSpeed = Clamp(pen->m_fTargetDist / fDistRotSpeed, fMinRotSpeed, fMaxRotSpeed);

  // max speed
  if (fSpeedLimit >= 0.0f) {
    vToTarget(1) = Clamp(vToTarget(1), -fSpeedLimit, fSpeedLimit);
    vToTarget(2) = Clamp(vToTarget(2), -fSpeedLimit, fSpeedLimit);
  }

  // set rotation speed
  sbl.aAim(1) = vToTarget(1) / fRotationSpeed;
  sbl.aAim(2) = vToTarget(2) / fRotationSpeed;

  // try to shoot
  if (Abs(vToTarget(1)) < SBS.fShootAngle && Abs(vToTarget(2)) < SBS.fShootAngle) {
    // shoot if the enemy is visible or the crosshair is on them
    BOOL bTargetingEnemy = WEAPON->m_penRayHit == pen->m_penTarget;

    if (sbl.SeeEnemy() || bTargetingEnemy) {
      sbl.ubFlags |= BLF_CANSHOOT;
    }
  }
};

// [Cecil] 2021-06-14: Set bot movement
void BotMovement(CPlayerBot *pen, CPlayerAction &pa, SBotLogic &sbl) {
  // no need to set any moving speed if nowhere to go
  if (!sbl.EnemyExists() && !sbl.ItemExists()
   && pen->m_penFollow == NULL && pen->m_pbppCurrent == NULL) {
    return;
  }

  const FLOAT3D &vBotPos = pen->GetPlacement().pl_PositionVector;

  // randomize strafe direction every once in a while
  if (pen->m_tmChangeBotDir <= _pTimer->CurrentTick()) {
    pen->m_fSideDir = (pen->IRnd() % 2 == 0) ? -1.0f : 1.0f;
    pen->m_tmChangeBotDir = _pTimer->CurrentTick() + (pen->FRnd() * 2.0f) + 2.0f; // 2 to 4 seconds
  }

  FLOAT3D vBotMovement = FLOAT3D(0.0f, 0.0f, 0.0f); // in which direction bot needs to go
  FLOAT fVerticalMove = 0.0f; // jumping or crouching

  SBotWeaponConfig &bwWeapon = sbl.aWeapons[pen->m_iBotWeapon]; // current weapon config

  // strafe further if lower health
  FLOAT fHealthRatio = Clamp(100.0f - pen->GetHealth(), 0.0f, 100.0f) / 100.0f;
  const FLOAT fStrafeRange = (bwWeapon.bw_fMaxDistance - bwWeapon.bw_fMinDistance) * bwWeapon.bw_fStrafe;

  // avoid the target in front of the bot
  FLOAT fStrafe = Clamp(fStrafeRange * fHealthRatio, 3.0f, 16.0f);

  if (SBS.bStrafe && pen->m_fTargetDist < (bwWeapon.bw_fMinDistance + fStrafe)
   && (pen->m_penFollow == NULL || pen->m_penFollow == pen->m_penTarget || sbl.Following())) {
    // run around the enemy
    vBotMovement = FLOAT3D(pen->m_fSideDir, 0.0f, 0.0f);

  } else {
    CPlacement3D plDelta = pen->GetPlacement();
    BOOL bShouldFollow = FALSE;
    BOOL bShouldJump = FALSE;
    BOOL bShouldCrouch = FALSE;
    
    // run towards the following target
    if (pen->m_penFollow != NULL) {
      // back off if needed
      if (sbl.BackOff()) {
        plDelta.pl_PositionVector = (vBotPos - pen->m_penFollow->GetPlacement().pl_PositionVector);
      } else {
        plDelta.pl_PositionVector = (pen->m_penFollow->GetPlacement().pl_PositionVector - vBotPos);
      }

      // check vertical difference
      FLOAT3D vVertical = VerticalDiff(plDelta.pl_PositionVector, pen->en_vGravityDir);

      // jump if it's higher
      bShouldJump = (vVertical.Length() > 1.0f);

      // jump if going for an item and not the player
      if (sbl.ItemExists()) {
        bShouldJump &= !sbl.Following();
      }

      bShouldFollow = TRUE;
    }
    
    // run towards the point
    if (pen->m_pbppCurrent != NULL) {
      // ignore the point if there's an item (if it exists and current point is target point)
      if (!sbl.ItemExists() || pen->m_pbppCurrent != pen->m_pbppTarget) {
        plDelta.pl_PositionVector = (pen->m_pbppCurrent->bpp_vPos - vBotPos);
        bShouldJump = pen->m_ulPointFlags & PPF_JUMP;
        bShouldCrouch = pen->m_ulPointFlags & PPF_CROUCH;

        bShouldFollow = TRUE;
      }
    }

    // set the speed if there's a place to go
    if (bShouldFollow && plDelta.pl_PositionVector.Length() > 0.0f) {
      FLOAT aDeltaHeading = GetRelH(plDelta);

      // compare directional difference
      FLOAT3D vHor = HorizontalDiff(plDelta.pl_PositionVector, pen->en_vGravityDir);
      FLOAT3D vVer = VerticalDiff(plDelta.pl_PositionVector, pen->en_vGravityDir);

      // stop moving if it's too high up
      if (vHor.Length() < 1.0f && vVer.Length() > 4.0f) {
        vBotMovement = FLOAT3D(0.0f, 0.0f, 0.0f);

      } else {
        FLOAT3D vRunDir;
        AnglesToDirectionVector(ANGLE3D(aDeltaHeading, 0.0f, 0.0f), vRunDir);
        vBotMovement = vRunDir;

        // crouch if needed instead of jumping
        if (bShouldCrouch) {
          fVerticalMove = -1.0f;

        // jump if allowed
        } else if (bShouldJump && SBS.bJump) {
          fVerticalMove = 1.0f;

        } else {
          fVerticalMove = 0.0f;
        }
      }
    }
  }

  // try to avoid obstacles
  BOOL bNowhereToGo = (pen->m_pbppCurrent == NULL || NoPosChange(pen));

  if (bNowhereToGo && WEAPON->m_fRayHitDistance < 4.0f
   && !(WEAPON->m_penRayHit->GetPhysicsFlags() & EPF_MOVABLE)) {
    // only jump if following players
    if (sbl.SeePlayer()) {
      fVerticalMove = 1.0f;

    } else {
      vBotMovement = FLOAT3D(pen->m_fSideDir, 0.0f, 1.0f);
    }
  }

  // vertical movement (holding crouch or spamming jump)
  if (fVerticalMove < -0.1f || (fVerticalMove > 0.1f && pen->ButtonAction())) {
    vBotMovement(2) = fVerticalMove;
  } else {
    vBotMovement(2) = 0.0f;
  }

  // move around
  const FLOAT3D vMoveSpeed = FLOAT3D(plr_fMoveSpeed, plr_fSpeedUp, plr_fMoveSpeed);

  // use direction instead of pressing buttons (it's like bot is using a controller)
  pa.pa_vTranslation(1) += vBotMovement(1) * vMoveSpeed(1);
  pa.pa_vTranslation(2) += vBotMovement(2) * vMoveSpeed(2);
  pa.pa_vTranslation(3) += vBotMovement(3) * vMoveSpeed(3);

  // walk if needed
  if (pen->m_ulPointFlags & PPF_WALK) {
    pa.pa_vTranslation(1) /= 2.0f;
    pa.pa_vTranslation(3) /= 2.0f;
  }
};
