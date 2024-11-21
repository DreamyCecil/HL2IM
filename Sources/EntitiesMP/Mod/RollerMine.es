5002
%{
#include "StdH.h"
%}

uses "EntitiesMP/Mod/PhysBase";
uses "EntitiesMP/BasicEffects";

class CRollerMine : CPhysBase {
name      "RollerMine";
thumbnail "Thumbnails\\RollingStone.tbn";
features  "HasName", "IsTargetable";

properties:
  1 CTString m_strName    "Name" = "Roller Mine",
  3 FLOAT m_fDamage       "Damage multiplier" 'D' = 1.0f,
  4 FLOAT m_fStretch      "Stretch" 'S' = 1.0f,

 10 CSoundObject m_soRoll,
 11 INDEX m_iRollSound = -1,
 12 INDEX m_iLastSound = -1,
 13 CSoundObject m_soState,

 20 BOOL m_bOpen = FALSE,
 21 BOOL m_bLogicLoop = TRUE,

 30 CEntityPointer m_penTarget,
 31 FLOAT m_fLastDist = -1.0f,
 32 FLOAT m_tmJump = -100.0f,
 33 BOOL m_bActive     "Active" = TRUE,

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

  // Physics overrides
  virtual INDEX GetPhysMaterial(void) const { return SUR_METAL_NORMAL; };
  virtual BOOL AreDecalsAllowed(void) const { return FALSE; };

  virtual ECollisionShape GetPhysCollision(FLOAT3D &vSize) const {
    const FLOAT fSize = (m_bOpen ? 1.588f : 1.256f) * m_fStretch;
    vSize = FLOAT3D(fSize, fSize, fSize);
    return COLSH_SPHERE;
  };

  virtual FLOAT GetPhysMass(void) const { return 0.5f * m_fStretch; };
  virtual FLOAT GetPhysBounce(void) const { return 0.8f; };

  virtual FLOAT GetPhysTouchDamage(const ETouch &eTouch) {
    // Only when not held
    if (m_syncGravityGun.IsSynced()) {
      return 0.0f;
    }

    // Control amount of damage based on movement speed relative to the target
    FLOAT3D vSpeed = en_vIntendedTranslation;

    if (eTouch.penOther->GetPhysicsFlags() & EPF_MOVABLE) {
      vSpeed -= ((CMovableEntity &)*eTouch.penOther).en_vCurrentTranslationAbsolute;
    }

    return Clamp((vSpeed.Length() - 10.0f) * 2.0f, 0.0f, 100.0f) * m_fDamage;
  };

  BOOL HandleEvent(const CEntityEvent &ee) {
    switch (ee.ee_slEvent) {
      case EVENTCODE_EActivate: {
        m_bActive = TRUE;
      } return TRUE;

      case EVENTCODE_EDeactivate: {
        m_bActive = FALSE;
        m_penTarget = NULL;
      } return TRUE;

      // Physics simulation
      case EVENTCODE_EPhysicsStart: {
        SetItemFlags(TRUE);
      } break;

      case EVENTCODE_EPhysicsStop: {
        SetItemFlags(FALSE);

        // Adjust item placement to prevent it from falling through the floor
        CPlacement3D plTeleport(GetPlacement().pl_PositionVector - en_vGravityDir, ANGLE3D(0, 0, 0));
        Teleport(plTeleport, FALSE);
        ForceFullStop();
      } break;
    }

    return CPhysBase::HandleEvent(ee);
  };

  virtual FLOAT GetPhysBlockDamage(const EBlock &eBlock) {
    ETouch eDummy;
    eDummy.penOther = eBlock.penOther;
    return GetPhysTouchDamage(eDummy);
  };

  BOOL AdjustShadingParameters(FLOAT3D &vLightDirection, COLOR &colLight, COLOR &colAmbient) {
    CPhysBase::AdjustShadingParameters(vLightDirection, colLight, colAmbient);
    return !PhysicsUsable(); // No shadow during physics
  };

  // Stretch some attachment
  void StretchAttachment(INDEX i, FLOAT fSize) {
    CAttachmentModelObject *pamo = GetModelObject()->GetAttachmentModel(i);

    if (pamo != NULL) {
      pamo->amo_moModelObject.StretchModel(FLOAT3D(fSize, fSize, fSize));
    }
  };

  // Open or close
  void MineState(BOOL bOpen, BOOL bSound) {
    if (GetModelObject() == NULL) {
      return;
    }

    m_bOpen = bOpen;

    // Resize physics object
    if (PhysicsUsable()) {
      FLOAT3D vSize;
      GetPhysCollision(vSize);
      PhysObj().SetSphere(vSize(1));
      PhysObj().Unfreeze();
    }

    if (bOpen) {
      // Hide closed model
      StretchAttachment(0, 0.0f);

      // Show open model
      StretchAttachment(1, m_fStretch);
      StretchAttachment(2, m_fStretch);

      if (bSound) {
        PlaySound(m_soState, SOUND_OPEN1 + IRnd() % 3, SOF_3D);
      }

    } else {
      // Show closed model
      StretchAttachment(0, m_fStretch);

      // Hide open model
      StretchAttachment(1, 0.0f);
      StretchAttachment(2, 0.0f);

      if (bSound) {
        PlaySound(m_soState, SOUND_CLOSE1 + IRnd() % 3, SOF_3D);
      }
    }
  };

  void ExplosionEffect(void) {
    ESpawnEffect ese;
    FLOAT3D vPoint;
    FLOATplane3D vPlaneNormal;
    FLOAT fDistanceToEdge;

    // Explosion
    ese.colMuliplier = C_WHITE|CT_OPAQUE;
    ese.betType = BET_ROCKET;
    ese.vStretch = FLOAT3D(m_fStretch, m_fStretch, m_fStretch);
    SpawnEffect(GetPlacement(), ese);

    // Explosion debris
    ese.betType = BET_EXPLOSION_DEBRIS;
    SpawnEffect(GetPlacement(), ese);

    // Explosion smoke
    ese.betType = BET_EXPLOSION_SMOKE;
    SpawnEffect(GetPlacement(), ese);

    if (GetNearestPolygon(vPoint, vPlaneNormal, fDistanceToEdge)) {
      if ((vPoint-GetPlacement().pl_PositionVector).Length() < 3.5f) {
        // Stain
        ese.betType = BET_EXPLOSIONSTAIN;
        ese.vNormal = FLOAT3D(vPlaneNormal);
        SpawnEffect(CPlacement3D(vPoint, ANGLE3D(0.0f, 0.0f, 0.0f)), ese);
        // Shock wave
        ese.betType = BET_SHOCKWAVE;
        ese.vNormal = FLOAT3D(vPlaneNormal);
        SpawnEffect(CPlacement3D(vPoint, ANGLE3D(0.0f, 0.0f, 0.0f)), ese);
        // Second explosion on plane
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

  void PostMoving() {
    CPhysBase::PostMoving();

    // Follow the target
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

    // Jump once in a while
    if (_pTimer->CurrentTick() > m_tmJump) {
      if (en_penReference != NULL) {
        vJump = -en_vGravityDir;
      }
      m_tmJump = _pTimer->CurrentTick() + 2.0f;
    }

    GiveImpulseTranslationAbsolute(vDiff.SafeNormalize() + en_vGravityDir + vJump);*/
  };

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

  // Set appropriate flags for the item
  void SetItemFlags(BOOL bRealisticPhysics) {
    if (bRealisticPhysics) {
      SetPhysicsFlags(EPF_BRUSH_MOVING | EPF_CUSTOMCOLLISION);
      SetCollisionFlags(ECF_PHYS_TESTALL | ECF_PHYS_ISMODEL);

    } else {
      SetPhysicsFlags(EPF_ONBLOCK_BOUNCE | EPF_PUSHABLE | EPF_MOVABLE | EPF_TRANSLATEDBYGRAVITY);
      SetCollisionFlags(ECF_MODEL);
    }
  };

procedures:
  Main() {
    InitAsModel();
    SetItemFlags(FALSE);
    SetModel(MODEL_BASE);
    SetModelMainTexture(TEXTURE_MINE);
    AddAttachmentToModel(this, *GetModelObject(), 0, MODEL_CLOSED, TEXTURE_MINE, 0, 0, 0);
    AddAttachmentToModel(this, *GetModelObject(), 1, MODEL_OPEN,   TEXTURE_MINE, 0, 0, 0);
    AddAttachmentToModel(this, *GetModelObject(), 2, MODEL_GLOW,   TEXTURE_GLOW, 0, 0, 0);

    GetModelObject()->StretchModel(FLOAT3D(1, 1, 1) * m_fStretch);
    ModelChangeNotify();

    MineState(FALSE, FALSE);

    autowait(ONE_TICK);
    SetItemFlags(ODE_IsStarted());

    AddToMovers();

    m_soState.Set3DParameters(50.0f, 10.0f, 1.0f, 1.0f);
    m_bLogicLoop = TRUE;

    while (m_bLogicLoop) {
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
          // Close
          MineState(FALSE, TRUE);

        } else if (m_penTarget != NULL && penLastTarget == NULL) {
          // Open and jump a little bit
          MineState(TRUE, TRUE);

          if (PhysicsUsable()) {
            const FLOAT3D vVertSpeed = VerticalDiff(PhysObj().GetCurrentTranslation(), en_vGravityDir);

            // Jump from opening if not moving vertically
            if (vVertSpeed.Length() < 0.1f) {
              FLOAT3D vPos = PhysObj().GetPosition();
              vPos -= en_vGravityDir * 0.332f * m_fStretch;

              PhysObj().SetPosition(vPos);
              PhysObj().AddForce(-en_vGravityDir, 3.0f / _pTimer->TickQuantum);
            }
          }
        }
      }

      wait (ONE_TICK) {
        on (EDeath) : {
          ExplosionEffect();
          InflictRangeDamage(this, DMT_EXPLOSION, 20 * m_fStretch, GetPlacement().pl_PositionVector, 2 * m_fStretch, 8 * m_fStretch);

          m_bLogicLoop = FALSE;
          stop;
        }

        on (ETimer) : { stop; }
        otherwise() : { resume; }
      }
    }

    // Destroy physics object
    DestroyObject(TRUE);

    // Cease to exist
    Destroy();

    return;
  }
};
