5002
%{
#include "StdH.h"

// [Cecil] Gravity Gun actions
#include "EntitiesMP/Cecil/Physics.h"
%}

uses "EntitiesMP/BasicEffects";

class CRollerMine : CMovableModelEntity {
name      "RollerMine";
thumbnail "Thumbnails\\RollingStone.tbn";
features  "HasName", "IsTargetable";

properties:
  1 CTString m_strName    "Name" = "Roller Mine",
  2 FLOAT m_fBounce       "Bounce" 'B' = 0.5f,
  3 FLOAT m_fDamage       "Damage" 'D' = 1000.0f,
  4 FLOAT m_fStretch      "Stretch" 'S' = 1.0f,
  5 FLOAT m_fDeceleration "Deceleration" = 0.9f,
  6 FLOAT m_fStartSpeed   "Start Speed" 'Z' = 50.0f,
  7 ANGLE3D m_vStartDir   "Start Direction" 'A' = ANGLE3D(0.0f, 0.0f, 0.0f),
  8 CEntityPointer m_penDeathTarget "Death target" 'T',

 // sound channels for bouncing sound
 10 CSoundObject m_soRoll,
 11 INDEX m_iRollSound = -1,
 12 INDEX m_iLastSound = -1,
 13 CSoundObject m_soState,

 20 FLOAT m_tmLastDamage = -100.0f,
 21 FLOAT3D m_vDamage = FLOAT3D(0.0f, 0.0f, 0.0f),

 30 CEntityPointer m_penTarget,
 31 FLOAT m_fLastDist = -1.0f,
 32 FLOAT m_tmJump = -100.0f,
 33 BOOL m_bActive     "Active" = TRUE,
 34 BOOL m_bTakeDamage "Take Damage" = FALSE,

 // internal vars
 50 FLOATquat3D m_qA = FLOATquat3D(0.0f, 1.0f, 0.0f, 0.0f),
 51 FLOATquat3D m_qALast = FLOATquat3D(0.0f, 1.0f, 0.0f, 0.0f),
 52 FLOAT m_fASpeed = 0.0f,
 53 FLOAT3D m_vR = FLOAT3D(0.0f, 0.0f, 1.0f),

 60 INDEX m_iLaunched = 0,

components:
  1 class CLASS_BASIC_EFFECT "Classes\\BasicEffect.ecl",

 10 model   MODEL_BASE   "Models\\Misc\\RollerMine\\Base.mdl",
 11 model   MODEL_CLOSED "Models\\Misc\\RollerMine\\RollerMineClosed.mdl",
 12 model   MODEL_OPEN   "Models\\Misc\\RollerMine\\RollerMineOpen.mdl",
 13 model   MODEL_GLOW   "Models\\Misc\\RollerMine\\Glow.mdl",
 14 texture TEXTURE_MINE "Models\\Misc\\RollerMine\\RollerMine.tex",
 15 texture TEXTURE_GLOW "Models\\Misc\\RollerMine\\Glow.tex",

 20 sound SOUND_SLOW "Models\\Misc\\RollerMine\\Sounds\\MoveSlow.wav",
 21 sound SOUND_FAST "Models\\Misc\\RollerMine\\Sounds\\MoveFast.wav",

 22 sound SOUND_CLOSE1 "Models\\Misc\\RollerMine\\Sounds\\Close1.wav",
 23 sound SOUND_CLOSE2 "Models\\Misc\\RollerMine\\Sounds\\Close2.wav",
 24 sound SOUND_CLOSE3 "Models\\Misc\\RollerMine\\Sounds\\Close3.wav",
 25 sound SOUND_OPEN1  "Models\\Misc\\RollerMine\\Sounds\\Open1.wav",
 26 sound SOUND_OPEN2  "Models\\Misc\\RollerMine\\Sounds\\Open2.wav",
 27 sound SOUND_OPEN3  "Models\\Misc\\RollerMine\\Sounds\\Open3.wav",

functions:
  void Precache(void) {
    PrecacheModel(MODEL_BASE);
    PrecacheModel(MODEL_CLOSED);
    PrecacheModel(MODEL_OPEN);
    PrecacheModel(MODEL_GLOW);
    PrecacheTexture(TEXTURE_MINE);
    PrecacheTexture(TEXTURE_GLOW);

    PrecacheSound(SOUND_SLOW);
    PrecacheSound(SOUND_FAST);

    PrecacheSound(SOUND_CLOSE1);
    PrecacheSound(SOUND_CLOSE2);
    PrecacheSound(SOUND_CLOSE3);
    PrecacheSound(SOUND_OPEN1);
    PrecacheSound(SOUND_OPEN2);
    PrecacheSound(SOUND_OPEN3);
  };

  // [Cecil] Open or close
  void MineState(BOOL bOpen, BOOL bSound) {
    if (GetModelObject() == NULL) {
      return;
    }

    const FLOAT3D vSize = FLOAT3D(m_fStretch, m_fStretch, m_fStretch);
    m_soState.Set3DParameters(50.0f, 10.0f, 1.0f, 1.0f);

    if (bOpen) {
      // hide closed model
      CAttachmentModelObject *pamo = GetModelObject()->GetAttachmentModel(0);
      if (pamo != NULL) {
        pamo->amo_moModelObject.StretchModel(FLOAT3D(0.0f, 0.0f, 0.0f));
      }

      // show open model
      pamo = GetModelObject()->GetAttachmentModel(1);
      if (pamo != NULL) {
        pamo->amo_moModelObject.StretchModel(vSize);
      }

      pamo = GetModelObject()->GetAttachmentModel(2);
      if (pamo != NULL) {
        pamo->amo_moModelObject.StretchModel(vSize);
      }

      if (bSound) {
        PlaySound(m_soState, SOUND_OPEN1 + IRnd()%3, SOF_3D);
      }

    } else {
      // show closed model
      CAttachmentModelObject *pamo = GetModelObject()->GetAttachmentModel(0);
      if (pamo != NULL) {
        pamo->amo_moModelObject.StretchModel(vSize);
      }

      // hide open model
      pamo = GetModelObject()->GetAttachmentModel(1);
      if (pamo != NULL) {
        pamo->amo_moModelObject.StretchModel(FLOAT3D(0.0f, 0.0f, 0.0f));
      }

      pamo = GetModelObject()->GetAttachmentModel(2);
      if (pamo != NULL) {
        pamo->amo_moModelObject.StretchModel(FLOAT3D(0.0f, 0.0f, 0.0f));
      }

      if (bSound) {
        PlaySound(m_soState, SOUND_CLOSE1 + IRnd()%3, SOF_3D);
      }
    }
  };

  // [Cecil] Explosion effect
  void ExplosionEffect(void) {
    ESpawnEffect ese;
    FLOAT3D vPoint;
    FLOATplane3D vPlaneNormal;
    FLOAT fDistanceToEdge;

    // explosion
    ese.colMuliplier = C_WHITE|CT_OPAQUE;
    ese.betType = BET_ROCKET;
    ese.vStretch = FLOAT3D(m_fStretch, m_fStretch, m_fStretch);
    SpawnEffect(GetPlacement(), ese);

    // explosion debris
    ese.betType = BET_EXPLOSION_DEBRIS;
    SpawnEffect(GetPlacement(), ese);

    // explosion smoke
    ese.betType = BET_EXPLOSION_SMOKE;
    SpawnEffect(GetPlacement(), ese);

    // on plane
    if (GetNearestPolygon(vPoint, vPlaneNormal, fDistanceToEdge)) {
      if ((vPoint-GetPlacement().pl_PositionVector).Length() < 3.5f) {
        // stain
        ese.betType = BET_EXPLOSIONSTAIN;
        ese.vNormal = FLOAT3D(vPlaneNormal);
        SpawnEffect(CPlacement3D(vPoint, ANGLE3D(0.0f, 0.0f, 0.0f)), ese);
        // shock wave
        ese.betType = BET_SHOCKWAVE;
        ese.vNormal = FLOAT3D(vPlaneNormal);
        SpawnEffect(CPlacement3D(vPoint, ANGLE3D(0.0f, 0.0f, 0.0f)), ese);
        // second explosion on plane
        ese.betType = BET_ROCKET_PLANE;
        ese.vNormal = FLOAT3D(vPlaneNormal);
        SpawnEffect(CPlacement3D(vPoint+ese.vNormal/50.0f, ANGLE3D(0, 0, 0)), ese);
      }
    }
  };

  void SpawnEffect(const CPlacement3D &plEffect, const ESpawnEffect &eSpawnEffect) {
    CEntityPointer penEffect = CreateEntity(plEffect, CLASS_BASIC_EFFECT);
    penEffect->Initialize(eSpawnEffect);
  };

  void ReceiveDamage(CEntity *penInflictor, enum DamageType dmtType, FLOAT fDamage, const FLOAT3D &vHitPoint, const FLOAT3D &vDirection) {
    // no damage
    if (fDamage <= 0.0f) {
      return;
    }

    // don't receive damage from enemies or players
    if (!IsDerivedFromClass(penInflictor, "Enemy Base") && !IS_PLAYER(penInflictor)) {
      CMovableModelEntity::ReceiveDamage(penInflictor, dmtType, fDamage, vHitPoint, vDirection);
      return;
    }

    // kick damage
    FLOAT fKickDamage = fDamage;
    if (dmtType == DMT_EXPLOSION || dmtType == DMT_IMPACT || dmtType == DMT_CANNONBALL_EXPLOSION) {
      fKickDamage *= 1.5f;
    }

    if (dmtType == DMT_DROWNING || dmtType == DMT_CHAINSAW) {
      fKickDamage /= 10.0f;
    }

    if (dmtType == DMT_BURNING) {
      fKickDamage /= 100000.0f;
    }

    // get passed time since last damage
    TIME tmNow = _pTimer->CurrentTick();
    TIME tmDelta = tmNow - m_tmLastDamage;
    m_tmLastDamage = tmNow;

    // fade damage out
    if (tmDelta >= _pTimer->TickQuantum * 3.0f) {
      m_vDamage = FLOAT3D(0.0f, 0.0f, 0.0f);
    }

    // add new damage
    FLOAT3D vDirectionFixed = -en_vGravityDir;
    if (vDirection.ManhattanNorm() > 0.5f) {
      vDirectionFixed = vDirection;
    }

    FLOAT3D vDamageOld = m_vDamage;
    m_vDamage += (vDirectionFixed - en_vGravityDir/2) * fKickDamage;
    
    // [Cecil] Use a new vector
    FLOAT fOldLen = vDamageOld.Length();
    FLOAT fNewLen = m_vDamage.Length();
    FLOAT fOldRootLen = Sqrt(fOldLen);
    FLOAT fNewRootLen = Sqrt(fNewLen);

    if (fOldLen != 0.0f) {
      // cancel last push
      GiveImpulseTranslationAbsolute(-vDamageOld/fOldRootLen);
    }

    // push it back
    GiveImpulseTranslationAbsolute(m_vDamage/fNewRootLen);

    if (m_bTakeDamage) {
      CMovableModelEntity::ReceiveDamage(penInflictor, dmtType, fDamage, vHitPoint, vDirection);
    }
  };

  void PostMoving() {
    CMovableModelEntity::PostMoving();

    if (en_penReference != NULL) {
      AdjustSpeeds(en_vReferencePlane);
    }

    m_qALast = m_qA;

    FLOATquat3D qRot;
    qRot.FromAxisAngle(m_vR, m_fASpeed*_pTimer->TickQuantum*PI/180);
    FLOATmatrix3D mRot;
    qRot.ToMatrix(mRot);
    m_qA = qRot*m_qA;

    if (en_ulFlags & ENF_INRENDERING) {
      m_qALast = m_qA;
    }

    // follow the target
    /*if (m_penTarget == NULL) {
      return;
    }

    FLOAT3D vAbsGravity = FLOAT3D(Abs(en_vGravityDir(1)), Abs(en_vGravityDir(2)), Abs(en_vGravityDir(3)));
    FLOAT3D vGravity = FLOAT3D(1.0f, 1.0f, 1.0f) - vAbsGravity;
    FLOAT3D vDiff = (m_penTarget->GetPlacement().pl_PositionVector - GetPlacement().pl_PositionVector);
    vDiff(1) *= vGravity(1);
    vDiff(2) *= vGravity(2);
    vDiff(3) *= vGravity(3);

    FLOAT3D vJump = FLOAT3D(0.0f, 0.0f, 0.0f);

    // jump once in a while
    if (_pTimer->CurrentTick() > m_tmJump) {
      if (en_penReference != NULL) {
        vJump = -en_vGravityDir;
      }
      m_tmJump = _pTimer->CurrentTick() + 2.0f;
    }

    GiveImpulseTranslationAbsolute(vDiff.SafeNormalize() + en_vGravityDir + vJump);*/
  };

  void AdjustMipFactor(FLOAT &fMipFactor) {
    fMipFactor = 0;

    FLOATquat3D qA;
    qA = Slerp(_pTimer->GetLerpFactor(), m_qALast, m_qA);
    
    FLOATmatrix3D mA;
    qA.ToMatrix(mA);
    ANGLE3D vA;
    DecomposeRotationMatrixNoSnap(vA, mA);

    CAttachmentModelObject *amo = GetModelObject()->GetAttachmentModel(0);
    if (amo != NULL) {
      amo->amo_plRelative.pl_OrientationAngle = vA;
    }

    amo = GetModelObject()->GetAttachmentModel(1);
    if (amo != NULL) {
      amo->amo_plRelative.pl_OrientationAngle = vA;
    }

    amo = GetModelObject()->GetAttachmentModel(2);
    if (amo != NULL) {
      amo->amo_plRelative.pl_OrientationAngle = vA;
    }
  };

  void AdjustSpeedOnOneAxis(FLOAT &fTraNow, FLOAT &aRotNow, BOOL bRolling) {
    FLOAT fR = 4.0f*m_fStretch / 5.0f; // size of original sphere model (4m) times stretch

    FLOAT fTraNew = (2*aRotNow*fR+5*fTraNow)/7;
    FLOAT aRotNew = fTraNew/fR;

    fTraNow = fTraNew;
    aRotNow = aRotNew;
  };

  // adjust rotation and translation speeds
  void AdjustSpeeds(const FLOAT3D &vPlane) {
    // if going too slow in translation and rotation
    /*if (en_vCurrentTranslationAbsolute.Length() < 1.0f && m_fASpeed < 1.0f) {
      // just stop
      en_vCurrentTranslationAbsolute = FLOAT3D(0.0f, 0.0f, 0.0f);
      m_fASpeed = 0.0f;
      RollSound(0.0f);
      return;
    }*/

    // decompose speed to components regarding the plane
    FLOAT3D vTranslationNormal;
    FLOAT3D vTranslationParallel;
    GetParallelAndNormalComponents(en_vCurrentTranslationAbsolute, vPlane, vTranslationNormal, vTranslationParallel);

    // check if rolling
    BOOL bRolling = vTranslationNormal.Length() <= 0.0f;
    // if rolling
    if (bRolling) {
      // get rotation direction from speed, if possible
      FLOAT fSpeedTra = vTranslationParallel.Length();
      RollSound(fSpeedTra);
    } else {
      RollSound(0.0f);
    }

    // what is caused by rotation
    FLOAT3D vRotFromRot = m_vR;
    FLOAT3D vTraFromRot = vPlane*vRotFromRot;
    vTraFromRot.Normalize();

    FLOAT fTraFromRot = 0;
    FLOAT fRotFromRot = m_fASpeed*PI/180.0f;

    // what is caused by translation
    FLOAT3D vTraFromTra = vTranslationParallel;
    FLOAT fTraFromTra = vTraFromTra.Length();
    FLOAT3D vRotFromTra = FLOAT3D(1.0f, 0.0f, 0.0f);
    FLOAT fRotFromTra = 0;
    if (fTraFromTra > 0.001f) {
      vTraFromTra /= fTraFromTra;
      vRotFromTra = vTraFromTra*vPlane;
      vRotFromTra.Normalize();
    }

    // if there is any rotation
    if (Abs(fRotFromRot) > 0.01f) {
      // adjust on rotation axis
      AdjustSpeedOnOneAxis(fTraFromRot, fRotFromRot, bRolling);
    }

    // if there is any translation
    if (Abs(fTraFromTra) > 0.01f) {
      // adjust on translation axis
      AdjustSpeedOnOneAxis(fTraFromTra, fRotFromTra, bRolling);
    }

    // put the speeds back together
    FLOATquat3D qTra;
    qTra.FromAxisAngle(vRotFromTra, fRotFromTra);
    FLOATquat3D qRot;
    qRot.FromAxisAngle(vRotFromRot, fRotFromRot);
    FLOATquat3D q = qRot*qTra;
    FLOAT3D vSpeed = vTraFromTra*fTraFromTra + vTraFromRot*fTraFromRot;

    // set the new speeds
    en_vCurrentTranslationAbsolute = vTranslationNormal+vSpeed;
    q.ToAxisAngle(m_vR, m_fASpeed);
    m_fASpeed *= 180.0f/PI;
  };

  /*void BounceSound(FLOAT fSpeed) {
    FLOAT fHitStrength = fSpeed*fSpeed;

    FLOAT fVolume = fHitStrength/20.0f; 
    fVolume = Clamp(fVolume, 0.0f, 2.0f);

    FLOAT fPitch = Lerp(0.2f, 1.0f, Clamp(fHitStrength/100.0f, 0.0f, 1.0f));
    if (fVolume < 0.1f) {
      return;
    }

    CSoundObject &so = (&m_soBounce0)[m_iNextChannel];
    m_iNextChannel = (m_iNextChannel+1) % 5;
    so.Set3DParameters(200.0f*m_fStretch, 100.0f*m_fStretch, fVolume, fPitch);
    PlaySound(so, SOUND_BOUNCE, SOF_3D);
  };*/

  void RollSound(FLOAT fSpeed) {
    FLOAT fHitStrength = fSpeed*fSpeed;

    FLOAT fVolume = fHitStrength/20.0f; 
    fVolume = Clamp(fVolume, 0.0f, 1.0f);

    if (fVolume <= 0.0f) {
      if (m_iRollSound != -1) {
        m_soRoll.Stop();
        m_iRollSound = -1;
        m_iLastSound = -1;
      }
      return;
    }
    m_soRoll.Set3DParameters(50.0f, 10.0f, 1.0f, 1.0f);

    // determine the sound
    m_iRollSound = (fVolume < 1.0f ? SOUND_SLOW : SOUND_FAST);

    // check the last sound
    if (m_iRollSound != m_iLastSound) {
      PlaySound(m_soRoll, m_iRollSound, SOF_3D|SOF_LOOP);
      m_iLastSound = m_iRollSound;
    }
  };

procedures:
  Main() {
    // set appearance
    InitAsModel();
    SetPhysicsFlags(EPF_ONBLOCK_BOUNCE | EPF_PUSHABLE | EPF_MOVABLE | EPF_TRANSLATEDBYGRAVITY);
    SetCollisionFlags(ECF_MODEL);
    SetModel(MODEL_BASE);
    SetModelMainTexture(TEXTURE_MINE);
    AddAttachmentToModel(this, *GetModelObject(), 0, MODEL_CLOSED, TEXTURE_MINE, 0, 0, 0);
    AddAttachmentToModel(this, *GetModelObject(), 1, MODEL_OPEN,   TEXTURE_MINE, 0, 0, 0);
    AddAttachmentToModel(this, *GetModelObject(), 2, MODEL_GLOW,   TEXTURE_GLOW, 0, 0, 0);

    GetModelObject()->StretchModel(FLOAT3D(m_fStretch, m_fStretch, m_fStretch));
    ModelChangeNotify();

    MineState(FALSE, FALSE);

    en_fBounceDampNormal = m_fBounce;
    en_fBounceDampParallel = m_fBounce;
    en_fAcceleration = m_fDeceleration;
    en_fDeceleration = m_fDeceleration;
    en_fCollisionSpeedLimit = 45.0f;
    en_fCollisionDamageFactor = 10.0f;

    SetPlacement(CPlacement3D(GetPlacement().pl_PositionVector, ANGLE3D(0.0f, 0.0f, 0.0f)));
    m_qA = FLOATquat3D(0.0f, 1.0f, 0.0f, 0.0f);
    m_qALast = FLOATquat3D(0.0f, 1.0f, 0.0f, 0.0f);

    autowait(0.05f);

    SetHealth(200.0f);
    AddToMovers();

    while (TRUE) {
      if (m_bActive) {
        CEntity *penLastTarget = m_penTarget;

        // reset selection
        CEntity *penSelect = NULL;
        m_fLastDist = -1.0f;

        for (INDEX iPlayer = 0; iPlayer < CEntity::GetMaxPlayers(); iPlayer++) {
          CEntity *pen = CEntity::GetPlayerEntity(iPlayer);

          if (pen == NULL || pen->GetFlags() & ENF_DELETED) {
            continue;
          }

          // distance to the target
          FLOAT fDist = DistanceTo(this, pen);

          // if not set yet or closer
          if (fDist < 16.0f && (m_fLastDist == -1.0f || fDist < m_fLastDist)) {
            penSelect = pen;
            m_fLastDist = fDist;
          }
        }

        // select the target
        m_penTarget = penSelect;

        if (m_penTarget == NULL && penLastTarget != NULL) {
          // close
          MineState(FALSE, TRUE);

          CPlacement3D plTeleport = GetPlacement();
          plTeleport.pl_PositionVector -= en_vGravityDir.SafeNormalize() * 0.2f * m_fStretch;
          Teleport(plTeleport, FALSE);

        } else if (m_penTarget != NULL && penLastTarget == NULL) {
          // open and jump a little bit
          MineState(TRUE, TRUE);
          GiveImpulseTranslationAbsolute(-en_vGravityDir * 5.0f);
        }
      }

      wait (0.05f) {
        on (EActivate) : {
          m_bActive = TRUE;
          resume;
        }

        on (EDeactivate) : {
          m_bActive = FALSE;
          m_penTarget = NULL;
          resume;
        }

        on (ETrigger) : {
          FLOAT3D v;
          AnglesToDirectionVector(m_vStartDir, v);
          GiveImpulseTranslationAbsolute(v*m_fStartSpeed);
          resume;
        }

        on (ETouch eTouch) : {
          // adjust rotation and translation speeds
          AdjustSpeeds(eTouch.plCollision);

          // if touched a brush
          /*if (eTouch.penOther->GetRenderType() & RT_BRUSH) {
            BounceSound(((FLOAT3D&)eTouch.plCollision) % en_vCurrentTranslationAbsolute);
          }*/

          // [Cecil] Hit someone if has been launched
          if (m_iLaunched > 0) {
            InflictDirectDamage(eTouch.penOther, this, DMT_EXPLOSION, m_iLaunched * 25.0f, GetPlacement().pl_PositionVector, en_vCurrentTranslationAbsolute);
            m_iLaunched--;
          }

          // [Cecil] Not launched anymore
          if (eTouch.penOther->GetRenderType() & RT_BRUSH) {
            m_iLaunched = 0;
          }
          resume;
        }

        on (EDeath eDeath) : {
          ExplosionEffect();
          InflictRangeDamage(this, DMT_EXPLOSION, 20.0f*m_fStretch, GetPlacement().pl_PositionVector, 2.0f*m_fStretch, 8.0f*m_fStretch);

          SendToTarget(m_penDeathTarget, EET_TRIGGER, eDeath.eLastDamage.penInflictor);
          Destroy();
          stop;
        }

        // [Cecil] Gravity Gun actions
        on (EGravityGunStart eStart) : {
          GravityGunStart(this, eStart.penTarget);
          resume;
        }
        on (EGravityGunStop eStop) : {
          GravityGunStop(this, eStop);
          resume;
        }
        on (EGravityGunHold eHold) : {
          GravityGunHolding(this, eHold);
          resume;
        }
        on (EGravityGunPush ePush) : {
          GravityGunPush(this, ePush.vDir);

          // [Cecil] Launch the mine
          if (ePush.bLaunch) {
            m_iLaunched = 3;
          }
          resume;
        }

        on (ETimer) : { stop; }
        otherwise() : { resume; }
      }
    }

    // cease to exist
    Destroy();
    return;
  }
};
