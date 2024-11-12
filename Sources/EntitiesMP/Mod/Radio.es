5003
%{
#include "StdH.h"

// Gravity Gun actions
#include "EntitiesMP/Cecil/Physics.h"

#include "EntitiesMP/EnemyBase.h"
%}

uses "EntitiesMP/Mod/PhysBase";
uses "EntitiesMP/BasicEffects";

class CRadio : CPhysBase {
name      "Radio";
thumbnail "Thumbnails\\MusicHolder.tbn";
features  "HasName", "IsTargetable";

properties:
  1 CTString m_strName "Name" = "Radio",
  2 CSoundObject m_soSong,
  
  5 BOOL m_bActive     "Active" = TRUE,
  6 BOOL m_bTakeDamage "Take Damage" = FALSE,

components:
  1 class CLASS_BASIC_EFFECT "Classes\\BasicEffect.ecl",

 10 model   MODEL_RADIO   "Models\\Misc\\Radio\\Radio.mdl",
 11 texture TEXTURE_RADIO "Models\\Misc\\Radio\\Radio.tex",
 12 sound   SOUND_SONG    "Models\\Misc\\Radio\\Loop.wav",

functions:
  void Precache(void) {
    PrecacheModel(MODEL_RADIO);
    PrecacheTexture(TEXTURE_RADIO);
    PrecacheSound(SOUND_SONG);
  };

  // Physics overrides
  virtual INDEX GetPhysMaterial(void) const { return SUR_METAL_GRATE_NORMAL; };
  virtual BOOL AreDecalsAllowed(void) const { return FALSE; };

  virtual ECollisionShape GetPhysCollision(FLOAT3D &vSize) const {
    vSize = FLOAT3D(1.05f, 0.68f, 0.4f);
    return COLSH_BOX;
  };

  virtual BOOL GetPhysOffset(CPlacement3D &plOffset) const {
    plOffset = CPlacement3D(FLOAT3D(0, 0.34f, 0.02f), ANGLE3D(0, 0, 0));
    return TRUE;
  };

  virtual FLOAT GetPhysMass(void) const { return 0.5f; };
  virtual FLOAT GetPhysFriction(void) const { return 0.7f; };
  virtual FLOAT GetPhysBounce(void) const { return 0.7f; };

  BOOL AdjustShadingParameters(FLOAT3D &vLightDirection, COLOR &colLight, COLOR &colAmbient) {
    CPhysBase::AdjustShadingParameters(vLightDirection, colLight, colAmbient);
    return !PhysicsUsable(); // No shadow during physics
  };

  void ExplosionEffect(void) {
    ESpawnEffect ese;
    FLOAT3D vPoint;
    FLOATplane3D vPlaneNormal;
    FLOAT fDistanceToEdge;

    // Explosion
    ese.colMuliplier = C_WHITE|CT_OPAQUE;
    ese.betType = BET_ROCKET;
    ese.vStretch = FLOAT3D(1.0f, 1.0f, 1.0f);
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

  void ReceiveDamage(CEntity *penInflictor, enum DamageType dmtType, FLOAT fDamage, const FLOAT3D &vHitPoint, const FLOAT3D &vDirection) {
    // No damage
    if (fDamage <= 0.0f) {
      return;
    }

    // Receive environment damage
    if (!IsDerivedFromID(penInflictor, CEnemyBase_ClassID) && !IS_PLAYER(penInflictor)) {
      CPhysBase::ReceiveDamage(penInflictor, dmtType, fDamage, vHitPoint, vDirection);
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

    // add new damage
    FLOAT3D vDirectionFixed = -en_vGravityDir;
    if (vDirection.ManhattanNorm() > 0.5f) {
      vDirectionFixed = vDirection;
    }

    FLOAT3D vDamage = (vDirectionFixed - en_vGravityDir/2) * fKickDamage;
    
    FLOAT fNewLen = vDamage.Length();
    FLOAT fNewRootLen = Sqrt(fNewLen);

    // push it back
    GiveImpulseTranslationAbsolute(vDamage/fNewRootLen);

    if (m_bTakeDamage) {
      CPhysBase::ReceiveDamage(penInflictor, dmtType, fDamage, vHitPoint, vDirection);
    } else {
      CPhysBase::PhysicsDamageImpact(dmtType, fDamage, vHitPoint, vDirection);
    }
  };

  // Set appropriate flags for the item
  void SetItemFlags(BOOL bRealisticPhysics) {
    if (bRealisticPhysics) {
      SetPhysicsFlags(EPF_BRUSH_MOVING | EPF_CUSTOMCOLLISION);
      SetCollisionFlags(ECF_PHYS_TESTALL | ECF_PHYS_ISMODEL);

    } else {
      SetPhysicsFlags(EPF_MODEL_SLIDING);
      SetCollisionFlags(ECF_MODEL);
    }
  };

procedures:
  Main() {
    InitAsModel();
    SetItemFlags(FALSE);
    SetModel(MODEL_RADIO);
    SetModelMainTexture(TEXTURE_RADIO);

    autowait(ONE_TICK);
    SetItemFlags(ODE_IsStarted());

    SetHealth(1000.0f);
    AddToMovers();
    m_soSong.Set3DParameters(32.0f, 4.0f, 1.0f, 1.0f);

    wait () {
      on (EBegin) : {
        if (m_bActive && !m_soSong.IsPlaying()) {
          PlaySound(m_soSong, SOUND_SONG, SOF_3D|SOF_LOOP|SOF_VOLUMETRIC);
        }
        resume;
      }

      on (EActivate) : {
        m_bActive = TRUE;

        if (!m_soSong.IsPlaying()) { 
          PlaySound(m_soSong, SOUND_SONG, SOF_3D|SOF_LOOP|SOF_VOLUMETRIC);
        }
        resume;
      }

      on (EDeactivate) : {
        m_bActive = FALSE;

        if (m_soSong.IsPlaying()) {
          m_soSong.Stop();
        }
        resume;
      }

      on (ETrigger) : {
        m_bActive = !m_bActive;
        
        if (m_bActive) {
          if (!m_soSong.IsPlaying()) {
            PlaySound(m_soSong, SOUND_SONG, SOF_3D|SOF_LOOP|SOF_VOLUMETRIC);
          }
        } else {
          m_soSong.Stop();
        }
        resume;
      }

      on (EDeath eDeath) : {
        ExplosionEffect();
        stop;
      }

      // Physics simulation
      on (EPhysicsStart) : {
        SetItemFlags(TRUE);
        resume;
      }

      on (EPhysicsStop) : {
        SetItemFlags(FALSE);

        // Adjust item placement to prevent it from falling through the floor
        ANGLE3D aGravity;
        UpVectorToAngles(-en_vGravityDir, aGravity);
        aGravity(1) = GetPlacement().pl_OrientationAngle(1);

        Teleport(CPlacement3D(PhysObj().GetPosition(), aGravity), FALSE);
        ForceFullStop();
        resume;
      }

      otherwise() : { resume; }
    }

    // Drop this object
    GravityGunObjectDrop(m_syncGravityGun);

    // Destory physics object and update objects around the item
    PhysObj().Clear(TRUE);

    if (_penGlobalController != NULL) {
      _penGlobalController->UpdatePhysObjects(FLOATaabbox3D(GetPlacement().pl_PositionVector, 8.0f));
    }

    // Cease to exist
    Destroy();

    return;
  }
};
