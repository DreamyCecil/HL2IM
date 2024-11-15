323
%{
#include "StdH.h"
#include "Models/Enemies/Eyeman/Eyeman.h"
%}

uses "EntitiesMP/EnemyFly";
uses "EntitiesMP/Eyeman";

%{
// info structure
static EntityInfo eiManhack = {
  EIBT_BONES, 120.0f, // [Cecil] EIBT_FLESH -> EIBT_BONES
  0.0f, 1.4f, 0.0f,
  0.0f, 1.0f, 0.0f,
};

#define BITE_AIR    3.0f
#define HIT_GROUND  2.0f
#define FIRE_GROUND   FLOAT3D(0.75f, 1.5f, -1.25f)

// [Cecil] Precache resources
void CManhack_Precache(void) {
  CDLLEntityClass *pdec = &CManhack_DLLClass;

  pdec->PrecacheModel(MODEL_MANHACK);
  pdec->PrecacheTexture(TEXTURE_MANHACK);

  pdec->PrecacheSound(SOUND_IDLE);
  pdec->PrecacheSound(SOUND_SIGHT);
  pdec->PrecacheSound(SOUND_WOUND);
  pdec->PrecacheSound(SOUND_BITE);
  pdec->PrecacheSound(SOUND_PUNCH);
  pdec->PrecacheSound(SOUND_DEATH);
  pdec->PrecacheSound(SOUND_MUMBLE);
};
%}

class CManhack : CEnemyFly {
name      "Manhack";
thumbnail "Thumbnails\\Eyeman.tbn";

properties:
  4 BOOL m_bMumbleSoundPlaying = FALSE,
  5 CSoundObject m_soMumble,

// [Cecil] Force flying
 10 BOOL m_bAlwaysFly "Force Flying" = TRUE,

components:
  0 class   CLASS_BASE         "Classes\\EnemyFly.ecl",
  1 model   MODEL_MANHACK      "Models\\Enemies\\Manhack\\Manhack.mdl",
  2 texture TEXTURE_MANHACK    "Models\\Enemies\\Manhack\\Manhack.tex",
  4 class   CLASS_BASIC_EFFECT "Classes\\BasicEffect.ecl",

// ************** SOUNDS **************
 50 sound   SOUND_IDLE      "Models\\Enemies\\Manhack\\Sounds\\Idle.wav",
 51 sound   SOUND_SIGHT     "Models\\Enemies\\Manhack\\Sounds\\Sight.wav",
 52 sound   SOUND_WOUND     "Models\\Enemies\\Manhack\\Sounds\\Wound.wav",
 53 sound   SOUND_BITE      "Models\\Enemies\\Manhack\\Sounds\\Bite.wav",
 54 sound   SOUND_PUNCH     "Models\\Enemies\\Manhack\\Sounds\\Punch.wav",
 55 sound   SOUND_DEATH     "Models\\Enemies\\Manhack\\Sounds\\Death.wav",
 56 sound   SOUND_MUMBLE    "Models\\Enemies\\Manhack\\Sounds\\Mumble.wav",

functions:
  // describe how this enemy killed player
  virtual CTString GetPlayerKillDescription(const CTString &strPlayerName, const EDeath &eDeath)
  {
    CTString str;
    if (m_bInAir) {
      str.PrintF(TRANS("%s was sliced up by a Manhack"), strPlayerName);
    } else {
      str.PrintF(TRANS("%s was sliced up by a Manhack"), strPlayerName);
    }
    return str;
  }

  void Precache(void) {
    CEnemyBase::Precache();
    CManhack_Precache();
  };

  // [Cecil] Remove stains for manhacks
  void LeaveStain(BOOL bGrow) {};

  // [Cecil] Drop batteries
  void DropItems(void) {
    if (IRnd() % 5 == 0) {
      CEntityPointer pen = SpawnArmor();
      pen->Initialize();

      CArmorItem *penArmor = (CArmorItem*)&*pen;
      penArmor->m_bDropped = TRUE;
      penArmor->m_bPickupOnce = TRUE;
      penArmor->m_fDropTime = 20.0f;
      pen->Reinitialize();
    }
  };

  /* Entity info */
  void *GetEntityInfo(void) {
    return &eiManhack;
  };

  /* Receive damage */
  void ReceiveDamage(CEntity *penInflictor, enum DamageType dmtType,
    FLOAT fDamageAmmount, const FLOAT3D &vHitPoint, const FLOAT3D &vDirection) 
  {
    // Manhack can't harm manhack
    if (!IsOfClass(penInflictor, "Manhack")) {
      CEnemyFly::ReceiveDamage(penInflictor, dmtType, fDamageAmmount, vHitPoint, vDirection);
      // if died of chainsaw
      if (dmtType==DMT_CHAINSAW && GetHealth()<=0) {
        // must always blowup
        m_fBlowUpAmount = 0;
      }
    }
  };

  /* Fill in entity statistics - for AI purposes only */
  BOOL FillEntityStatistics(EntityStats *pes) {
    CEnemyBase::FillEntityStatistics(pes);
    pes->es_strName += " Manhack";

    return TRUE;
  }

  virtual const CTFileName &GetComputerMessageName(void) const {
    static DECLARE_CTFILENAME(fnmManhack, "Data\\Messages\\Enemies\\Manhack.txt");
    return fnmManhack;
  };

  // damage anim
  INDEX AnimForDamage(FLOAT fDamage) {
    DeactivateMumblingSound();
    INDEX iAnim;
    if (m_bInAir) {
      switch (IRnd()%2) {
        case 0: iAnim = EYEMAN_ANIM_MORPHWOUND01; break;
        case 1: iAnim = EYEMAN_ANIM_MORPHWOUND02; break;
        default: ASSERTALWAYS("Manhack unknown fly damage");
      }
    } else {
      FLOAT3D vFront;
      GetHeadingDirection(0, vFront);
      FLOAT fDamageDir = m_vDamage%vFront;
      if (Abs(fDamageDir)<=10) {
        switch (IRnd()%3) {
          case 0: iAnim = EYEMAN_ANIM_WOUND03; break;
          case 1: iAnim = EYEMAN_ANIM_WOUND06; break;
          case 2: iAnim = EYEMAN_ANIM_WOUND07; break;
        }
      } else {
        if (fDamageDir<0) {
          iAnim = EYEMAN_ANIM_FALL01;
        } else {
          iAnim = EYEMAN_ANIM_FALL02;
        }
      }
    }
    StartModelAnim(iAnim, 0);
    return iAnim;
  };

  // death
  INDEX AnimForDeath(void) {
    DeactivateMumblingSound();
    INDEX iAnim;
    if (m_bInAir) {
      iAnim = EYEMAN_ANIM_MORPHDEATH;
    } else {
      FLOAT3D vFront;
      GetHeadingDirection(0, vFront);
      FLOAT fDamageDir = m_vDamage%vFront;
      if (fDamageDir<0) {
        iAnim = EYEMAN_ANIM_DEATH02;
      } else {
        iAnim = EYEMAN_ANIM_DEATH01;
      }
    }
    StartModelAnim(iAnim, 0);
    return iAnim;
  };

  FLOAT WaitForDust(FLOAT3D &vStretch) {
    if(GetModelObject()->GetAnim()==EYEMAN_ANIM_DEATH01)
    {
      vStretch=FLOAT3D(1,1,1)*0.75f;
      return 0.5f;
    }
    else if(GetModelObject()->GetAnim()==EYEMAN_ANIM_DEATH02)
    {
      vStretch=FLOAT3D(1,1,1)*0.75f;
      return 0.5f;
    }
    else if(GetModelObject()->GetAnim()==EYEMAN_ANIM_MORPHDEATH)
    {
      vStretch=FLOAT3D(1,1,1)*1.0f;
      return 0.5f;
    }
    return -1.0f;
  };

  void DeathNotify(void) {
    ChangeCollisionBoxIndexWhenPossible(EYEMAN_COLLISION_BOX_DEATH);
    en_fDensity = 500.0f;
  };

  // mumbling sounds
  void ActivateMumblingSound(void)
  {
    if (!m_bMumbleSoundPlaying) {
      PlaySound(m_soMumble, SOUND_MUMBLE, SOF_3D|SOF_LOOP);
      m_bMumbleSoundPlaying = TRUE;
    }
  }
  void DeactivateMumblingSound(void)
  {
    m_soMumble.Stop();
    m_bMumbleSoundPlaying = FALSE;
  }

  // virtual anim functions
  void StandingAnim(void) {
    DeactivateMumblingSound();
    if (m_bInAir) {
      StartModelAnim(EYEMAN_ANIM_MORPHATTACKFLY, AOF_LOOPING|AOF_NORESTART);
    } else {
      StartModelAnim(EYEMAN_ANIM_STAND, AOF_LOOPING|AOF_NORESTART);
    }
  };
  void WalkingAnim(void) {
    ActivateMumblingSound();
    if (m_bInAir) {
      StartModelAnim(EYEMAN_ANIM_MORPHATTACKFLY, AOF_LOOPING|AOF_NORESTART);
    } else {
      StartModelAnim(EYEMAN_ANIM_WALK, AOF_LOOPING|AOF_NORESTART);
    }
  };
  void RunningAnim(void) {
    ActivateMumblingSound();
    if (m_bInAir) {
      StartModelAnim(EYEMAN_ANIM_MORPHATTACKFLY, AOF_LOOPING|AOF_NORESTART);
    } else {
      StartModelAnim(EYEMAN_ANIM_RUN, AOF_LOOPING|AOF_NORESTART);
    }
  };
  void RotatingAnim(void) {
    if (m_bInAir) {
      StartModelAnim(EYEMAN_ANIM_MORPHATTACKFLY, AOF_LOOPING|AOF_NORESTART);
    } else {
      StartModelAnim(EYEMAN_ANIM_RUN, AOF_LOOPING|AOF_NORESTART);
    }
  };
  FLOAT AirToGroundAnim(void) {
    StartModelAnim(EYEMAN_ANIM_MORPHUP, 0);
    return(GetModelObject()->GetAnimLength(EYEMAN_ANIM_MORPHUP));
  };
  FLOAT GroundToAirAnim(void) {
    StartModelAnim(EYEMAN_ANIM_MORPHDOWN, 0);
    return(GetModelObject()->GetAnimLength(EYEMAN_ANIM_MORPHDOWN));
  };
  void ChangeCollisionToAir() {
    ChangeCollisionBoxIndexWhenPossible(EYEMAN_COLLISION_BOX_AIR);
  };
  void ChangeCollisionToGround() {
    ChangeCollisionBoxIndexWhenPossible(EYEMAN_COLLISION_BOX_GROUND);
  };

  // virtual sound functions
  void IdleSound(void) {
    PlaySound(m_soSound, SOUND_IDLE, SOF_3D);
  };
  void SightSound(void) {
    PlaySound(m_soSound, SOUND_SIGHT, SOF_3D);
  };
  void WoundSound(void) {
    PlaySound(m_soSound, SOUND_WOUND, SOF_3D);
  };
  void DeathSound(void) {
    PlaySound(m_soSound, SOUND_DEATH, SOF_3D);
  };

  // [Cecil] Mark as HL2 enemy
  virtual EHalfLifeEnemy GetHalfLifeEnemyType(void) const {
    return HLENEMY_BETA;
  };

/************************************************************
 *                     MOVING FUNCTIONS                     *
 ************************************************************/
  // check whether may move while attacking
  BOOL MayMoveToAttack(void) 
  {
    if (m_bInAir) {
      return WouldNotLeaveAttackRadius();
    } else {
      return CEnemyBase::MayMoveToAttack();
    }
  }

  // must be more relaxed about hitting then usual enemies
  BOOL CanHitEnemy(CEntity *penTarget, FLOAT fCosAngle) {
    if (IsInPlaneFrustum(penTarget, fCosAngle)) {
      return IsVisibleCheckAll(penTarget);
    }
    return FALSE;
  };
procedures:
/************************************************************
 *                A T T A C K   E N E M Y                   *
 ************************************************************/

  FlyHit(EVoid) : CEnemyFly::FlyHit {
    if (CalcDist(m_penEnemy) > BITE_AIR) {
      m_fShootTime = _pTimer->CurrentTick() + 0.25f;
      return EReturn();
    }
    StartModelAnim(EYEMAN_ANIM_MORPHATTACK, 0);
    StopMoving();
    PlaySound(m_soSound, SOUND_BITE, SOF_3D);
    // damage enemy
    autowait(0.4f);
    // damage enemy
    if (CalcDist(m_penEnemy) < BITE_AIR) {
      FLOAT3D vDirection = m_penEnemy->GetPlacement().pl_PositionVector-GetPlacement().pl_PositionVector;
      vDirection.SafeNormalize();

      // [Cecil] Hit point on the enemy position
      FLOAT3D vHit = m_penEnemy->GetPlacement().pl_PositionVector;
      InflictDirectDamage(m_penEnemy, this, DMT_CLOSERANGE, 3.5f, vHit, vDirection);
      // spawn blood cloud
      ESpawnEffect eSpawnEffect;
      eSpawnEffect.colMuliplier = C_WHITE|CT_OPAQUE;
      eSpawnEffect.betType = BET_BLOODEXPLODE;
      eSpawnEffect.vStretch = FLOAT3D(1,1,1);
      CPlacement3D plOne = GetPlacement();
      GetEntityPointRatio(
        FLOAT3D(Lerp(-0.2f, +0.2f, FRnd()), Lerp(-0.2f, +0.2f, FRnd()), -1.0f),
        plOne.pl_PositionVector);
      CEntityPointer penBloodCloud = CreateEntity( plOne, CLASS_BASIC_EFFECT);
      penBloodCloud->Initialize( eSpawnEffect);
    }
    autowait(0.24f);

    StandingAnim();
    return EReturn();
  };

  GroundHit(EVoid) : CEnemyFly::GroundHit {
    if (CalcDist(m_penEnemy) > HIT_GROUND) {
      m_fShootTime = _pTimer->CurrentTick() + 0.25f;
      return EReturn();
    }
    StartModelAnim(EYEMAN_ANIM_ATTACK02, 0);
    StopMoving();
    // damage enemy
    autowait(0.2f);
    // damage enemy
    if (CalcDist(m_penEnemy) < HIT_GROUND) {
      FLOAT3D vDirection = m_penEnemy->GetPlacement().pl_PositionVector-GetPlacement().pl_PositionVector;
      vDirection.SafeNormalize();

      // [Cecil] Hit point on the enemy position
      FLOAT3D vHit = m_penEnemy->GetPlacement().pl_PositionVector;
      InflictDirectDamage(m_penEnemy, this, DMT_CLOSERANGE, 3.5f, vHit, vDirection);
      PlaySound(m_soSound, SOUND_PUNCH, SOF_3D);
    }
    autowait(0.3f);
    // damage enemy
    if (CalcDist(m_penEnemy) < HIT_GROUND) {
      FLOAT3D vDirection = m_penEnemy->GetPlacement().pl_PositionVector-GetPlacement().pl_PositionVector;
      vDirection.SafeNormalize();

      // [Cecil] Hit point on the enemy position
      FLOAT3D vHit = m_penEnemy->GetPlacement().pl_PositionVector;
      InflictDirectDamage(m_penEnemy, this, DMT_CLOSERANGE, 3.5f, vHit, vDirection);
      PlaySound(m_soSound, SOUND_PUNCH, SOF_3D);
    }
    autowait(0.4f);

    StandingAnim();
    return EReturn();
  };

/************************************************************
 *                       M  A  I  N                         *
 ************************************************************/
  Main(EVoid) {
    // declare yourself as a model
    InitAsModel();
    SetPhysicsFlags(EPF_MODEL_WALKING|EPF_HASLUNGS);
    SetCollisionFlags(ECF_MODEL);
    SetFlags(GetFlags()|ENF_ALIVE|ENF_CLUSTERSHADOWS);

    // [Cecil] Force flying
    if (m_bAlwaysFly) {
      m_EeftType = EFT_FLY_ONLY;
    }

    SetHealth(90.0f);
    m_fMaxHealth = 90.0f;
    // damage/explode properties
    m_fBlowUpAmount = 1E10f; // [Cecil] Can't blow up
    m_fBodyParts = 5;
    m_fBlowUpSize = 2.5f;
    m_fDamageWounded = 40.0f;

    en_fDensity = 2000.0f;

    if (m_EeftType == EFT_GROUND_ONLY) {
      en_tmMaxHoldBreath = 5.0f;
    } else {
      en_tmMaxHoldBreath = 30.0f;
    }

    // [Cecil] New spray particles
    m_sptType = SPT_ELECTRICITY_SPARKS_NO_BLOOD;

    // set your appearance
    SetModel(MODEL_MANHACK);
    SetModelMainTexture(TEXTURE_MANHACK);
    m_iScore = 500;

    GetModelObject()->StretchModel(FLOAT3D(1.0f, 1.0f, 1.0f));
    ModelChangeNotify();

    // setup moving speed
    m_fWalkSpeed = FRnd() + 1.5f;
    m_aWalkRotateSpeed = FRnd()*10.0f + 500.0f;

    m_fAttackRunSpeed = FRnd()*2.0f + 10.0f;
    m_aAttackRotateSpeed = AngleDeg(FRnd()*100 + 600.0f);
    m_fCloseRunSpeed = FRnd()*2.0f + 10.0f;
    m_aCloseRotateSpeed = AngleDeg(FRnd()*100 + 600.0f);

    // setup attack distances
    m_fAttackDistance = 100.0f;
    m_fCloseDistance = 3.5f;
    m_fStopDistance = 1.5f;
    m_fAttackFireTime = 2.0f;
    m_fCloseFireTime = 0.5f;
    m_fIgnoreRange = 200.0f;
    // fly moving properties
    m_fFlyWalkSpeed = FRnd()*2.0f + 3.0f;
    m_aFlyWalkRotateSpeed = FRnd()*20.0f + 600.0f;

    m_fFlyAttackRunSpeed = FRnd()*2.0f + 9.5f;
    m_aFlyAttackRotateSpeed = FRnd()*25 + 350.0f;
    m_fFlyCloseRunSpeed = FRnd()*2.0f + 9.5f;
    m_aFlyCloseRotateSpeed = FRnd()*50 + 400.0f;

    m_fGroundToAirSpeed = 2.5f;
    m_fAirToGroundSpeed = 2.5f;
    m_fAirToGroundMin = 0.1f;
    m_fAirToGroundMax = 0.1f;
    m_fFlyHeight = 1.0f;
    // attack properties - CAN BE SET
    m_fFlyAttackDistance = 100.0f;
    m_fFlyCloseDistance = 10.0f;
    m_fFlyStopDistance = 1.5f;
    m_fFlyAttackFireTime = 2.0f;
    m_fFlyCloseFireTime = 0.5f;
    m_fFlyIgnoreRange = 200.0f;
    m_soMumble.Set3DParameters(25.0f, 0.0f, 1.0f, 1.0f);

    // [Cecil] Mark as HL2 enemy
    SetHalfLifeEnemyType();

    // continue behavior in base class
    jump CEnemyFly::MainLoop();
  };
};
