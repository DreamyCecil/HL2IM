5003
%{
#include "StdH.h"

// [Cecil] Gravity Gun actions
#include "EntitiesMP/Cecil/Physics.h"

#include "EntitiesMP/EnemyBase.h"
%}

uses "EntitiesMP/BasicEffects";

class CRadio : CMovableModelEntity {
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

  // [Cecil] Explosion effect
  void ExplosionEffect(void) {
    ESpawnEffect ese;
    FLOAT3D vPoint;
    FLOATplane3D vPlaneNormal;
    FLOAT fDistanceToEdge;

    // explosion
    ese.colMuliplier = C_WHITE|CT_OPAQUE;
    ese.betType = BET_ROCKET;
    ese.vStretch = FLOAT3D(1.0f, 1.0f, 1.0f);
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

    // Receive environment damage
    if (!IsDerivedFromID(penInflictor, CEnemyBase_ClassID) && !IS_PLAYER(penInflictor)) {
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
      CMovableModelEntity::ReceiveDamage(penInflictor, dmtType, fDamage, vHitPoint, vDirection);
    }
  };

procedures:
  Main() {
    // set appearance
    InitAsModel();
    SetPhysicsFlags(EPF_MODEL_SLIDING);
    SetCollisionFlags(ECF_MODEL);
    SetModel(MODEL_RADIO);
    SetModelMainTexture(TEXTURE_RADIO);

    autowait(0.05f);

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
        resume;
      }
      
      otherwise() : { resume; }
    }

    // cease to exist
    Destroy();
    return;
  }
};
