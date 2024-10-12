303
%{
#include "StdH.h"
#include "Models/Enemies/Headman/Headman.h"
%}

uses "EntitiesMP/EnemyBase";
uses "EntitiesMP/BasicEffects";
uses "EntitiesMP/Bullet"; // [Cecil]

enum ECopWeapon {
  0 COP_SMG      "SMG",
  1 COP_PISTOL   "Pistol",
  2 COP_GRENADES "Grenades",
  3 COP_KAMIKAZE "Kamikaze",
};

%{
// info structure
static EntityInfo eiMetrocop = {
  EIBT_FLESH, 100.0f,
  0.0f, 1.9f, 0.0f,     // source (eyes)
  0.0f, 1.0f, 0.0f,     // target (body)
};

#define EXPLODE_KAMIKAZE   2.5f
#define BOMBERMAN_ANGLE (45.0f)
#define BOMBERMAN_LAUNCH (FLOAT3D(0.0f, 1.5f, 0.0f))

// [Cecil] Fire positions
#define PISTOL_FIRE FLOAT3D(0.07f, 1.8f, -0.6f)
#define SMG1_FIRE   FLOAT3D(0.07f, 0.85f, -0.7f)
%}

class CMetrocop : CEnemyBase {
name      "Metrocop";
thumbnail "Thumbnails\\Headman.tbn";

properties:
  1 enum ECopWeapon m_hdtType "Type" 'Y' = COP_SMG,

  // class internal
  5 BOOL m_bExploded = FALSE,
  6 BOOL m_bAttackSound = FALSE,    // playing kamikaze yelling sound

{
  CEntity *penBullet; // [Cecil] Bullet
}
  
components:
  1 class   CLASS_BASE         "Classes\\EnemyBase.ecl",
  2 class   CLASS_BASIC_EFFECT "Classes\\BasicEffect.ecl",
  3 class   CLASS_PROJECTILE   "Classes\\Projectile.ecl",
  4 class   CLASS_BULLET       "Classes\\Bullet.ecl", // [Cecil]

 10 model   MODEL_COP             "Models\\Enemies\\Metrocop\\Metrocop.mdl",
 13 model   MODEL_CHAINSAW        "Models\\Enemies\\Metrocop\\ChainSaw.mdl",
 15 model   MODEL_ROCKETLAUNCHER  "Models\\Enemies\\Metrocop\\RocketLauncher.mdl",
 17 model   MODEL_BOMB            "Models\\Enemies\\Metrocop\\Projectile\\Bomb.mdl",

 20 texture TEXTURE_COP             "Models\\Enemies\\Metrocop\\Metrocop.tex",
 26 texture TEXTURE_CHAINSAW        "Models\\Enemies\\Metrocop\\Chainsaw.tex",
 28 texture TEXTURE_ROCKETLAUNCHER  "Models\\Enemies\\Metrocop\\RocketLauncher.tex",
 29 texture TEXTURE_BOMB            "Models\\Enemies\\Metrocop\\Projectile\\Bomb.tex",

// ************** SOUNDS **************
 50 sound   SOUND_IDLE              "Models\\Enemies\\Metrocop\\Sounds\\Idle.wav",
 51 sound   SOUND_IDLEKAMIKAZE      "Models\\Enemies\\Metrocop\\Sounds\\IdleKamikaze.wav",
 52 sound   SOUND_SIGHT             "Models\\Enemies\\Metrocop\\Sounds\\Sight.wav",
 53 sound   SOUND_WOUND             "Models\\Enemies\\Metrocop\\Sounds\\Wound.wav",
 54 sound   SOUND_FIREROCKETMAN     "Models\\Enemies\\Metrocop\\Sounds\\FireRocketman.wav",
 55 sound   SOUND_FIREFIRECRACKER   "Models\\Enemies\\Metrocop\\Sounds\\FireFirecracker.wav",
 56 sound   SOUND_FIREBOMBERMAN     "Models\\Enemies\\Metrocop\\Sounds\\FireBomberman.wav",
 57 sound   SOUND_ATTACKKAMIKAZE    "Models\\Enemies\\Metrocop\\Sounds\\AttackKamikaze.wav",
 58 sound   SOUND_DEATH             "Models\\Enemies\\Metrocop\\Sounds\\Death.wav",

functions:
  // describe how this enemy killed player
  virtual CTString GetPlayerKillDescription(const CTString &strPlayerName, const EDeath &eDeath)
  {
    CTString str;
    if (eDeath.eLastDamage.dmtType == DMT_EXPLOSION) {
      if (m_hdtType == COP_GRENADES) {
        str.PrintF(TRANS("Civil Protection officer blew up %s"), strPlayerName);
      } else {
        str.PrintF(TRANS("%s became a victim of a suicidal Civil Protection officer"), strPlayerName);
      }
    } else if (m_hdtType == COP_PISTOL) {
      str.PrintF(TRANS("Civil Protection officer has shot %s"), strPlayerName);
    } else if (m_hdtType == COP_SMG) {
      str.PrintF(TRANS("Civil Protection officer has killed %s"), strPlayerName);
    }
    return str;
  }

  /* Entity info */
  void *GetEntityInfo(void) {
    return &eiMetrocop;
  };

  virtual const CTFileName &GetComputerMessageName(void) const {
    static DECLARE_CTFILENAME(fnmMetrocop, "Data\\Messages\\Enemies\\Metrocop.txt");

    return fnmMetrocop;
  };

  void Precache(void) {
    CEnemyBase::Precache();
    PrecacheSound(SOUND_IDLE);
    PrecacheSound(SOUND_SIGHT);
    PrecacheSound(SOUND_WOUND);
    PrecacheSound(SOUND_DEATH);

    PrecacheModel(MODEL_BOMB);
    PrecacheTexture(TEXTURE_BOMB);

    PrecacheSound(SOUND_FIREFIRECRACKER);
    PrecacheSound(SOUND_FIREBOMBERMAN);
    PrecacheSound(SOUND_FIREROCKETMAN);
    PrecacheSound(SOUND_ATTACKKAMIKAZE);
    PrecacheSound(SOUND_IDLEKAMIKAZE);

    PrecacheClass(CLASS_PROJECTILE, PRT_HEADMAN_FIRECRACKER);
    PrecacheClass(CLASS_PROJECTILE, PRT_HEADMAN_ROCKETMAN);
    PrecacheClass(CLASS_PROJECTILE, PRT_HEADMAN_BOMBERMAN);
    PrecacheClass(CLASS_BASIC_EFFECT, BET_BOMB);
  };

  void AdjustDifficulty(void) {
    // [Cecil] Reload the model
    SetModel(MODEL_COP);
    SetModelMainTexture(TEXTURE_COP);

    switch (m_hdtType) {
      case COP_SMG:
        AddAttachment(HEADMAN_ATTACHMENT_CHAINSAW, MODEL_CHAINSAW, TEXTURE_CHAINSAW);
        break;
  
      case COP_PISTOL:
        AddAttachment(HEADMAN_ATTACHMENT_ROCKET_LAUNCHER, MODEL_ROCKETLAUNCHER, TEXTURE_ROCKETLAUNCHER);
        break;

      case COP_GRENADES:
        break;

      case COP_KAMIKAZE:
        AddAttachment(HEADMAN_ATTACHMENT_BOMB_RIGHT_HAND, MODEL_BOMB, TEXTURE_BOMB);
        AddAttachment(HEADMAN_ATTACHMENT_BOMB_LEFT_HAND, MODEL_BOMB, TEXTURE_BOMB);
        break;
    }

    GetModelObject()->StretchModel(FLOAT3D(1.25f, 1.25f, 1.25f));
    ModelChangeNotify();

    // [Cecil] Increase health
    SetHealth(70.0f);
    m_fMaxHealth = 70.0f;
    m_fDamageWounded = 25.0f;

    CEnemyBase::AdjustDifficulty();
  };

  // [Cecil] Drop weapons
  void DropItems(void) {
    if (IRnd() % 4 == 0) {
      switch (m_hdtType) {
        // either SMG1 or alt ammo
        case COP_SMG: {
          if (IRnd() % 4) {
            CEntityPointer pen = SpawnWeapon();
            pen->Initialize();

            CWeaponItem *penWeapon = (CWeaponItem*)&*pen;
            penWeapon->m_bDropped = TRUE;
            penWeapon->m_bPickupOnce = TRUE;
            penWeapon->m_fDropTime = 20.0f;
            penWeapon->m_EwitType = WIT_SMG1;
            pen->Reinitialize();

          } else {
            CEntityPointer pen = SpawnPowerUp();
            pen->Initialize();

            CPowerUpItem *penPower = (CPowerUpItem*)&*pen;
            penPower->m_puitType = PUIT_SPEED;
            penPower->m_bDropped = TRUE;
            penPower->m_bPickupOnce = TRUE;
            penPower->m_fDropTime = 30.0f;
            pen->Reinitialize();
          }
        } break;

        // Pistol
        case COP_PISTOL: {
          CEntityPointer pen = SpawnWeapon();
          pen->Initialize();

          CWeaponItem *penWeapon = (CWeaponItem*)&*pen;
          penWeapon->m_bDropped = TRUE;
          penWeapon->m_bPickupOnce = TRUE;
          penWeapon->m_fDropTime = 20.0f;
          penWeapon->m_EwitType = WIT_USP;
          pen->Reinitialize();
        } break;

        // Grenades
        case COP_GRENADES: {
          CEntityPointer pen = SpawnWeapon();
          pen->Initialize();

          CWeaponItem *penWeapon = (CWeaponItem*)&*pen;
          penWeapon->m_bDropped = TRUE;
          penWeapon->m_bPickupOnce = TRUE;
          penWeapon->m_fDropTime = 20.0f;
          penWeapon->m_EwitType = WIT_GRENADE;
          pen->Reinitialize();
        } break;
      }
    }
  };
  
  // [Cecil] Better Enemies
  void PrepareBullet(FLOAT3D vPos, FLOAT fDamage) {
    CPlacement3D plBullet;
    plBullet.pl_OrientationAngle = ANGLE3D(0, 0, 0);
    plBullet.pl_PositionVector = vPos;
    plBullet.RelativeToAbsolute(GetPlacement());

    penBullet = CreateEntity(plBullet, CLASS_BULLET);
    EBulletInit eInit;
    eInit.penOwner = this;
    eInit.fDamage = fDamage;
    penBullet->Initialize(eInit);
  };

  void FireBullet(FLOAT3D vPos, FLOAT fDamage, FLOAT fJitter) {
    PrepareBullet(vPos, fDamage);

    // [Cecil] Get moving offset
    FLOAT3D vOffset = ((CMovableEntity*)&*m_penEnemy)->en_vCurrentTranslationAbsolute * (FRnd()*0.5f);

    ((CBullet&)*penBullet).CalcTarget(m_penEnemy, -vOffset, 250);
    ((CBullet&)*penBullet).CalcJitterTarget(fJitter);
    ((CBullet&)*penBullet).LaunchBullet(TRUE, TRUE, TRUE);
    ((CBullet&)*penBullet).DestroyBullet();
  };

  /* Fill in entity statistics - for AI purposes only */
  BOOL FillEntityStatistics(EntityStats *pes) {
    CEnemyBase::FillEntityStatistics(pes);
    switch(m_hdtType) {
      case COP_SMG:      { pes->es_strName+=" Firecracker"; } break;
      case COP_PISTOL:   { pes->es_strName+=" Rocketman"; } break;
      case COP_GRENADES: { pes->es_strName+=" Bomberman"; } break;
      case COP_KAMIKAZE: { pes->es_strName+=" Kamikaze"; } break;
    }
    return TRUE;
  };

  /* Receive damage */
  void ReceiveDamage(CEntity *penInflictor, enum DamageType dmtType,
    FLOAT fDamageAmmount, const FLOAT3D &vHitPoint, const FLOAT3D &vDirection) {
    // Metrocops can't harm each other
    if (!IsOfClass(penInflictor, "Metrocop") || 
        !(((CMetrocop*)penInflictor)->m_hdtType == COP_SMG || 
          ((CMetrocop*)penInflictor)->m_hdtType == COP_PISTOL)) {
      CEnemyBase::ReceiveDamage(penInflictor, dmtType, fDamageAmmount, vHitPoint, vDirection);

      // if died of chainsaw
      if (dmtType==DMT_CHAINSAW && GetHealth()<=0) {
        // must always blowup
        m_fBlowUpAmount = 0;
      }
    }
  };

  // damage anim
  INDEX AnimForDamage(FLOAT fDamage) {
    INDEX iAnim;
    if (IRnd()%2) {
      iAnim = HEADMAN_ANIM_WOUND1;
    } else {
      iAnim = HEADMAN_ANIM_WOUND2;
    }
    StartModelAnim(iAnim, 0);
    return iAnim;
  };

  // death
  INDEX AnimForDeath(void) {
    INDEX iAnim;
    FLOAT3D vFront;
    GetHeadingDirection(0, vFront);
    FLOAT fDamageDir = m_vDamage%vFront;
    if (fDamageDir<0) {
      if (Abs(fDamageDir)<10.0f) {
        iAnim = HEADMAN_ANIM_DEATH_EASY_FALL_BACK;
      } else {
        iAnim = HEADMAN_ANIM_DEATH_FALL_BACK;
      }
    } else {
      if (Abs(fDamageDir)<10.0f) {
        iAnim = HEADMAN_ANIM_DEATH_EASY_FALL_FORWARD;
      } else {
        iAnim = HEADMAN_ANIM_DEATH_FALL_ON_KNEES;
      }
    }

    StartModelAnim(iAnim, 0);
    return iAnim;
  };

  FLOAT WaitForDust(FLOAT3D &vStretch) {
    vStretch = FLOAT3D(1, 1, 2);
    if (GetModelObject()->GetAnim() == HEADMAN_ANIM_DEATH_EASY_FALL_BACK) {
      vStretch = vStretch*0.3f;
      return 0.864f;
    }
    if (GetModelObject()->GetAnim() == HEADMAN_ANIM_DEATH_FALL_BACK) {
      vStretch = vStretch*0.75f;
      return 0.48f;
    }    
    if (GetModelObject()->GetAnim() == HEADMAN_ANIM_DEATH_EASY_FALL_FORWARD) {
      vStretch = vStretch*0.3f;
      return 1.12f;
    } else if (GetModelObject()->GetAnim() == HEADMAN_ANIM_DEATH_FALL_ON_KNEES) {
      vStretch = vStretch*0.75f;
      return 1.035f;
    }
    return -1.0f;
  };

  // should this enemy blow up (spawn debris)
  BOOL ShouldBlowUp(void) {
    if (m_hdtType == COP_KAMIKAZE && GetHealth() <= 0) {
      return TRUE;
    }
    return CEnemyBase::ShouldBlowUp();
  };

  void DeathNotify(void) {
    ChangeCollisionBoxIndexWhenPossible(HEADMAN_COLLISION_BOX_DEATH);
    en_fDensity = 500.0f;
  };

  // virtual anim functions
  void StandingAnim(void) {
    StartModelAnim(HEADMAN_ANIM_IDLE_PATROL, AOF_LOOPING|AOF_NORESTART);
    if (m_hdtType==COP_KAMIKAZE) {
      KamikazeSoundOff();
    }
  };

  void StandingAnimFight(void) {
    StartModelAnim(HEADMAN_ANIM_IDLE_FIGHT, AOF_LOOPING|AOF_NORESTART);
    if (m_hdtType == COP_KAMIKAZE) {
      KamikazeSoundOff();
    }
  };
  void WalkingAnim(void) {
    StartModelAnim(HEADMAN_ANIM_WALK, AOF_LOOPING|AOF_NORESTART);
  };
  void RunningAnim(void) {
    if (m_hdtType == COP_KAMIKAZE) {
      KamikazeSoundOn();
      StartModelAnim(HEADMAN_ANIM_KAMIKAZE_ATTACK, AOF_LOOPING|AOF_NORESTART);
    } else {
      StartModelAnim(HEADMAN_ANIM_RUN, AOF_LOOPING|AOF_NORESTART);
    }
  };
  void RotatingAnim(void) {
    RunningAnim();
  };

  // virtual sound functions
  void IdleSound(void) {
    if (m_bAttackSound) {
      return;
    }
    if (m_hdtType == COP_KAMIKAZE) {
      PlaySound(m_soSound, SOUND_IDLEKAMIKAZE, SOF_3D);
    } else {
      PlaySound(m_soSound, SOUND_IDLE, SOF_3D);
    }
  };
  void SightSound(void) {
    if (m_bAttackSound) {
      return;
    }
    PlaySound(m_soSound, SOUND_SIGHT, SOF_3D);
  };
  void WoundSound(void) {
    if (m_bAttackSound) {
      return;
    }
    PlaySound(m_soSound, SOUND_WOUND, SOF_3D);
  };
  void DeathSound(void) {
    if (m_bAttackSound) {
      return;
    }
    PlaySound(m_soSound, SOUND_DEATH, SOF_3D);
  };
  void KamikazeSoundOn(void) {
    if (!m_bAttackSound) {
      m_bAttackSound = TRUE;
      PlaySound(m_soSound, SOUND_ATTACKKAMIKAZE, SOF_3D|SOF_LOOP);
    }
  };
  void KamikazeSoundOff(void) {
    if (m_bAttackSound) {
      m_soSound.Stop();
      m_bAttackSound = FALSE;
    }
  };

/************************************************************
 *                 BLOW UP FUNCTIONS                        *
 ************************************************************/
  void BlowUpNotify(void) {
    // kamikaze and bomberman explode if is not already exploded
    if (m_hdtType == COP_KAMIKAZE || m_hdtType == COP_GRENADES) {
      Explode();
    }
  };

  // bomberman and kamikaze explode only once
  void Explode(void) {
    if (!m_bExploded) {
      m_bExploded = TRUE;

      // inflict damage
      FLOAT3D vSource;
      GetEntityInfoPosition(this, eiMetrocop.vTargetCenter, vSource);

      if (m_hdtType == COP_GRENADES) {
        InflictDirectDamage(this, this, DMT_EXPLOSION, 100.0f, vSource, 
          -en_vGravityDir);
        InflictRangeDamage(this, DMT_EXPLOSION, 15.0f, vSource, 1.0f, 6.0f);

      } else {
        InflictDirectDamage(this, this, DMT_CLOSERANGE, 100.0f, vSource, 
          -en_vGravityDir);
        InflictRangeDamage(this, DMT_EXPLOSION, 30.0f, vSource, 2.75f, 8.0f);
      }

      // spawn explosion
      CPlacement3D plExplosion = GetPlacement();
      CEntityPointer penExplosion = CreateEntity(plExplosion, CLASS_BASIC_EFFECT);
      ESpawnEffect eSpawnEffect;
      eSpawnEffect.colMuliplier = C_WHITE|CT_OPAQUE;
      eSpawnEffect.betType = BET_BOMB;
      eSpawnEffect.vStretch = FLOAT3D(1.0f,1.0f,1.0f);
      penExplosion->Initialize(eSpawnEffect);

      // explosion debris
      eSpawnEffect.betType = BET_EXPLOSION_DEBRIS;
      CEntityPointer penExplosionDebris = CreateEntity(plExplosion, CLASS_BASIC_EFFECT);
      penExplosionDebris->Initialize(eSpawnEffect);

      // explosion smoke
      eSpawnEffect.betType = BET_EXPLOSION_SMOKE;
      CEntityPointer penExplosionSmoke = CreateEntity(plExplosion, CLASS_BASIC_EFFECT);
      penExplosionSmoke->Initialize(eSpawnEffect);
    }
  };

// ******
// overrides from CEnemyBase to provide exploding on close range

  // set speeds for movement towards desired position
  void SetSpeedsToDesiredPosition(const FLOAT3D &vPosDelta, FLOAT fPosDistance, BOOL bGoingToPlayer)
  {
    // if very close to player
    if (m_hdtType == COP_KAMIKAZE && CalcDist(m_penEnemy) < EXPLODE_KAMIKAZE) {
      // explode
      SetHealth(-10000.0f);
      m_vDamage = FLOAT3D(0,10000,0);
      SendEvent(EDeath());

    // if not close
    } else {
      // behave as usual
      CEnemyBase::SetSpeedsToDesiredPosition(vPosDelta, fPosDistance, bGoingToPlayer);
    }
  }

  // get movement frequency for attack
  virtual FLOAT GetAttackMoveFrequency(FLOAT fEnemyDistance)
  {
    // kamikaze must have sharp reflexes when close
    if (m_hdtType == COP_KAMIKAZE && fEnemyDistance < m_fCloseDistance) {
      return 0.1f;
    } else {
      return CEnemyBase::GetAttackMoveFrequency(fEnemyDistance);
    }
  }

procedures:
/************************************************************
 *                A T T A C K   E N E M Y                   *
 ************************************************************/
  InitializeAttack(EVoid) : CEnemyBase::InitializeAttack {
    if (m_hdtType == COP_KAMIKAZE) {
      KamikazeSoundOn();
    }
    jump CEnemyBase::InitializeAttack();
  };

  StopAttack(EVoid) : CEnemyBase::StopAttack {
    KamikazeSoundOff();
    jump CEnemyBase::StopAttack();
  };

  Fire(EVoid) : CEnemyBase::Fire {
    // firecracker
    if (m_hdtType == COP_SMG) {
      autocall FirecrackerAttack() EEnd;
    // rocketman
    } else if (m_hdtType == COP_PISTOL) {
      autocall RocketmanAttack() EEnd;
    // bomber
    } else if (m_hdtType == COP_GRENADES) {
      autocall BombermanAttack() EEnd;
    // kamikaze
    } else if (m_hdtType == COP_KAMIKAZE) {
    }

    return EReturn();
  };

  // Bomberman attack
  BombermanAttack(EVoid) {
    // don't shoot if enemy above or below you too much
    if ( !IsInFrustum(m_penEnemy, CosFast(80.0f)) ) {
      return EEnd();
    }

    autowait(0.2f + FRnd()/4);

    StartModelAnim(HEADMAN_ANIM_BOMBERMAN_ATTACK, 0);
    PlaySound(m_soSound, SOUND_FIREBOMBERMAN, SOF_3D);
    autowait(0.15f);

    AddAttachment(HEADMAN_ATTACHMENT_BOMB_RIGHT_HAND, MODEL_BOMB, TEXTURE_BOMB);
    autowait(0.30f);
    RemoveAttachment(HEADMAN_ATTACHMENT_BOMB_RIGHT_HAND);

    // hit bomb
    // calculate launch velocity and heading correction for angular launch
    FLOAT fLaunchSpeed;
    FLOAT fRelativeHdg;
    CalculateAngularLaunchParams(
      GetPlacement().pl_PositionVector, BOMBERMAN_LAUNCH(2)-1.5f,
      m_penEnemy->GetPlacement().pl_PositionVector, FLOAT3D(0,0,0),
      BOMBERMAN_ANGLE,
      fLaunchSpeed,
      fRelativeHdg);
    
    // target enemy body
    EntityInfo *peiTarget = (EntityInfo*) (m_penEnemy->GetEntityInfo());
    FLOAT3D vShootTarget;
    GetEntityInfoPosition(m_penEnemy, peiTarget->vTargetCenter, vShootTarget);
    // launch
    CPlacement3D pl;
    PrepareFreeFlyingProjectile(pl, vShootTarget, BOMBERMAN_LAUNCH, ANGLE3D(0, BOMBERMAN_ANGLE, 0));
    CEntityPointer penProjectile = CreateEntity(pl, CLASS_PROJECTILE);
    ELaunchProjectile eLaunch;
    eLaunch.penLauncher = this;
    
    // [Cecil] Throw a real grenade
    eLaunch.prtType = PRT_GRENADE;

    eLaunch.fSpeed = fLaunchSpeed;
    penProjectile->Initialize(eLaunch);

    // safety remove - if hitted (EWounded) while have bomb in his hand, bomb will never be removed
    RemoveAttachment(HEADMAN_ATTACHMENT_BOMB_RIGHT_HAND);

    autowait(0.45f + FRnd()/2);
    return EEnd();
  };

  // Firecraker attack
  FirecrackerAttack(EVoid) {
    // don't shoot if enemy above you more than quare of two far from you
    if (-en_vGravityDir%CalcDelta(m_penEnemy) > CalcDist(m_penEnemy)/1.41421f) {
      return EEnd();
    }

    autowait(0.2f + FRnd()/4);

    StartModelAnim(HEADMAN_ANIM_FIRECRACKER_ATTACK, 0);
    autowait(0.15f);
    PlaySound(m_soSound, SOUND_FIREFIRECRACKER, SOF_3D);
    autowait(0.52f);

    // [Cecil] Shoot 5 bullets
    FireBullet(SMG1_FIRE, 2.0f, 50.0f);

    autowait(0.05f);
    FireBullet(SMG1_FIRE, 2.0f, 50.0f);

    autowait(0.05f);
    FireBullet(SMG1_FIRE, 2.0f, 50.0f);

    autowait(0.05f);
    FireBullet(SMG1_FIRE, 2.0f, 50.0f);

    autowait(0.05f);
    FireBullet(SMG1_FIRE, 2.0f, 50.0f);

    autowait(0.5f + FRnd()/3);
    return EEnd();
  };

  // Rocketman attack
  RocketmanAttack(EVoid) {
    StandingAnimFight();
    autowait(0.2f + FRnd()/4);

    // [Cecil] Shoot one bullet
    FireBullet(PISTOL_FIRE, (IRnd() % 2) + 1.0f, 30.0f);

    StartModelAnim(HEADMAN_ANIM_ROCKETMAN_ATTACK, 0);
    PlaySound(m_soSound, SOUND_FIREROCKETMAN, SOF_3D);

    autowait(1.0f + FRnd()/3);
    return EEnd();
  };

/************************************************************
 *                    D  E  A  T  H                         *
 ************************************************************/
  Death(EVoid) : CEnemyBase::Death {
    // instead, stop playing the yelling sound
    if (m_hdtType == COP_KAMIKAZE) {
      KamikazeSoundOff();
    }
    // death
    autocall CEnemyBase::Death() EEnd;
    // bomberman explode
    if (m_hdtType == COP_GRENADES) {
      Explode();
    }
    return EEnd();
  };



/************************************************************
 *                       M  A  I  N                         *
 ************************************************************/
  Main(EVoid) {
    // declare yourself as a model
    InitAsModel();
    SetPhysicsFlags(EPF_MODEL_WALKING|EPF_HASLUNGS);
    SetCollisionFlags(ECF_MODEL);
    SetFlags(GetFlags()|ENF_ALIVE);
    SetHealth(19.5f);
    m_fMaxHealth = 19.5f;
    en_tmMaxHoldBreath = 5.0f;
    en_fDensity = 2000.0f;
    m_fBlowUpSize = 2.0f;

    // set your appearance
    SetModel(MODEL_COP);
    SetModelMainTexture(TEXTURE_COP);

    switch (m_hdtType) {
      case COP_SMG:
        AddAttachment(HEADMAN_ATTACHMENT_CHAINSAW, MODEL_CHAINSAW, TEXTURE_CHAINSAW);
        // setup moving speed
        m_fWalkSpeed = FRnd() + 1.5f;
        m_aWalkRotateSpeed = AngleDeg(FRnd()*10.0f + 500.0f);
        m_fAttackRunSpeed = FRnd() + 5.0f;
        m_aAttackRotateSpeed = AngleDeg(FRnd()*50 + 245.0f);
        m_fCloseRunSpeed = FRnd() + 5.0f;
        m_aCloseRotateSpeed = AngleDeg(FRnd()*50 + 245.0f);
        // setup attack distances
        m_fAttackDistance = 50.0f;
        m_fCloseDistance = 0.0f;
        m_fStopDistance = 8.0f;
        m_fAttackFireTime = 2.0f;
        m_fCloseFireTime = 1.0f;
        m_fIgnoreRange = 200.0f;
        // damage/explode properties
        m_fBlowUpAmount = 1E10f; // [Cecil] Can't blow up
        m_fBodyParts = 4;
        m_fDamageWounded = 0.0f;
        m_iScore = 200;
        break;
  
      case COP_PISTOL:
        AddAttachment(HEADMAN_ATTACHMENT_ROCKET_LAUNCHER, MODEL_ROCKETLAUNCHER, TEXTURE_ROCKETLAUNCHER);
        // setup moving speed
        m_fWalkSpeed = FRnd() + 1.5f;
        m_aWalkRotateSpeed = AngleDeg(FRnd()*10.0f + 500.0f);
        m_fAttackRunSpeed = FRnd()*2.0f + 6.0f;
        m_aAttackRotateSpeed = AngleDeg(FRnd()*50 + 245.0f);
        m_fCloseRunSpeed = FRnd()*2.0f + 6.0f;
        m_aCloseRotateSpeed = AngleDeg(FRnd()*50 + 245.0f);
        // setup attack distances
        m_fAttackDistance = 50.0f;
        m_fCloseDistance = 0.0f;
        m_fStopDistance = 8.0f;
        m_fAttackFireTime = 2.0f;
        m_fCloseFireTime = 1.0f;
        m_fIgnoreRange = 200.0f;
        // damage/explode properties
        m_fBlowUpAmount = 1E10f; // [Cecil] Can't blow up
        m_fBodyParts = 4;
        m_fDamageWounded = 0.0f;
        m_iScore = 100;
        break;

      case COP_GRENADES:
        // setup moving speed
        m_fWalkSpeed = FRnd() + 1.5f;
        m_aWalkRotateSpeed = AngleDeg(FRnd()*10.0f + 500.0f);
        m_fAttackRunSpeed = FRnd() + 4.0f;
        m_aAttackRotateSpeed = AngleDeg(FRnd()*50 + 245.0f);
        m_fCloseRunSpeed = FRnd() + 4.0f;
        m_aCloseRotateSpeed = AngleDeg(FRnd()*50 + 245.0f);
        // setup attack distances
        m_fAttackDistance = 45.0f;
        m_fCloseDistance = 0.0f;
        m_fStopDistance = 20.0f;
        m_fAttackFireTime = 2.0f;
        m_fCloseFireTime = 1.5f;
        m_fIgnoreRange = 150.0f;
        // damage/explode properties
        m_fBlowUpAmount = 1E10f; // [Cecil] Can't blow up
        m_fBodyParts = 4;
        m_fDamageWounded = 0.0f;
        m_iScore = 500;
        break;

      case COP_KAMIKAZE:
        AddAttachment(HEADMAN_ATTACHMENT_BOMB_RIGHT_HAND, MODEL_BOMB, TEXTURE_BOMB);
        AddAttachment(HEADMAN_ATTACHMENT_BOMB_LEFT_HAND, MODEL_BOMB, TEXTURE_BOMB);
        // setup moving speed
        m_fWalkSpeed = FRnd() + 1.5f;
        m_aWalkRotateSpeed = AngleDeg(FRnd()*10.0f + 500.0f);
        m_fAttackRunSpeed = FRnd()*2.0f + 10.0f;
        m_aAttackRotateSpeed = AngleDeg(FRnd()*100 + 600.0f);
        m_fCloseRunSpeed = FRnd()*2.0f + 10.0f;
        m_aCloseRotateSpeed = AngleDeg(FRnd()*100 + 600.0f);
        // setup attack distances
        m_fAttackDistance = 50.0f;
        m_fCloseDistance = 10.0f;
        m_fStopDistance = 0.0f;
        m_fAttackFireTime = 2.0f;
        m_fCloseFireTime = 0.5f;
        m_fIgnoreRange = 250.0f;
        // damage/explode properties
        m_fBlowUpAmount = 0.0f;
        m_fBodyParts = 4;
        m_fDamageWounded = 0.0f;
        m_iScore = 2500;
        break;
    }

    // set stretch factors for height and width
    GetModelObject()->StretchModel(FLOAT3D(1.25f, 1.25f, 1.25f));
    ModelChangeNotify();
    StandingAnim();

    // [Cecil] Mark as HL2 enemy
    m_eHLEnemy = HLENEMY_BETA;

    // continue behavior in base class
    jump CEnemyBase::MainLoop();
  };
};
