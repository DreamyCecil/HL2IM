343
%{
#include "StdH.h"
#include "ModelsMP/Enemies/Grunt/Grunt.h"
%}

uses "EntitiesMP/EnemyBase";
uses "EntitiesMP/BasicEffects";
uses "EntitiesMP/Bullet"; // [Cecil]

enum ECombineSoldier {
  0 CS_OVERWATCH "Overwatch Soldier",
  1 CS_PRISON    "Prison Guard",
};

%{
#define STRETCH_SOLDIER   1.2f
#define STRETCH_COMMANDER STRETCH_SOLDIER //1.4f
  
// info structure
static EntityInfo eiSoldier = {
  EIBT_FLESH, 200.0f,
  0.0f, 1.9f*STRETCH_SOLDIER, 0.0f, // source (eyes)
  0.0f, 1.3f*STRETCH_SOLDIER, 0.0f, // target (body)
};

#define FIREPOS_SOLDIER   FLOAT3D(0.07f, 1.36f, -0.78f)*STRETCH_SOLDIER
#define FIREPOS_COMMANDER FLOAT3D(0.10f, 1.30f, -0.60f)*STRETCH_COMMANDER

// [Cecil]
#define AR2_FIRE FLOAT3D(0.15f, 1.30f, -0.7f)*STRETCH_SOLDIER
%}

class CCombineSoldier : CEnemyBase {
name      "CombineSoldier";
thumbnail "Thumbnails\\Grunt.tbn";

properties:
  1 enum ECombineSoldier m_gtType "Type" 'Y' = CS_OVERWATCH,

  10 CSoundObject m_soFire1,
  11 CSoundObject m_soFire2,

{
  CEntity *penBullet; // [Cecil] Bullet
}

components:
  1 class   CLASS_BASE       "Classes\\EnemyBase.ecl",
  3 class   CLASS_PROJECTILE "Classes\\Projectile.ecl",
  5 class   CLASS_BULLET     "Classes\\Bullet.ecl", // [Cecil]

 10 model   MODEL_GRUNT           "Models\\Enemies\\CombineSoldier\\Soldier.mdl",
 11 texture TEXTURE_SOLDIER       "Models\\Enemies\\CombineSoldier\\RifleSoldier.tex",
 12 texture TEXTURE_COMMANDER     "Models\\Enemies\\CombineSoldier\\ShotgunSoldier.tex",

 20 model   MODEL_GUN_SOLDIER     "Models\\Enemies\\CombineSoldier\\Rifle.mdl",
 21 texture TEXTURE_GUN_SOLDIER   "Models\\Enemies\\CombineSoldier\\Rifle.tex",
 22 model   MODEL_GUN_COMMANDER   "Models\\Enemies\\CombineSoldier\\Shotgun.mdl",
 23 texture TEXTURE_GUN_COMMANDER "Models\\Enemies\\CombineSoldier\\Shotgun.tex",
 
// ************** SOUNDS **************
 50 sound SOUND_IDLE  "Models\\Enemies\\CombineSoldier\\Sounds\\Idle.wav",
 52 sound SOUND_SIGHT "Models\\Enemies\\CombineSoldier\\Sounds\\Sight.wav",
 53 sound SOUND_WOUND "Models\\Enemies\\CombineSoldier\\Sounds\\Wound.wav",
 58 sound SOUND_DEATH "Models\\Enemies\\CombineSoldier\\Sounds\\Death.wav",

 // [Cecil] New sounds
 60 sound SOUND_AR2   "Models\\Enemies\\CombineSoldier\\Sounds\\FireAR2.wav",
 61 sound SOUND_SPAS1 "Models\\Weapons\\SPAS12\\Sounds\\Fire1.wav",
 62 sound SOUND_SPAS2 "Models\\Weapons\\SPAS12\\Sounds\\Fire2.wav",

functions:
    
  // describe how this enemy killed player
  virtual CTString GetPlayerKillDescription(const CTString &strPlayerName, const EDeath &eDeath)
  {
    CTString str;
    str.PrintF(TRANS("An Overwatch Soldier killed %s"), strPlayerName);
    return str;
  }

  /* Entity info */
  void *GetEntityInfo(void) {
    return &eiSoldier;
  };

  virtual const CTFileName &GetComputerMessageName(void) const {
    static DECLARE_CTFILENAME(fnmSoldier,   "Data\\Messages\\Enemies\\RifleSoldier.txt");
    static DECLARE_CTFILENAME(fnmCommander, "Data\\Messages\\Enemies\\ShotgunSoldier.txt");
    switch(m_gtType) {
      default: ASSERT(FALSE);
      case CS_OVERWATCH: return fnmSoldier;
      case CS_PRISON: return fnmCommander;
    }
  };

  void AdjustDifficulty(void) {
    // [Cecil] Reload the model
    SetModel(MODEL_GRUNT);

    switch (m_gtType) {
      case CS_OVERWATCH:
        SetModelMainTexture(TEXTURE_SOLDIER);
        AddAttachment(GRUNT_ATTACHMENT_GUN_SMALL, MODEL_GUN_SOLDIER, TEXTURE_GUN_SOLDIER);
        GetModelObject()->StretchModel(FLOAT3D(STRETCH_SOLDIER, STRETCH_SOLDIER, STRETCH_SOLDIER));
        break;
      case CS_PRISON:
        SetModelMainTexture(TEXTURE_COMMANDER);
        AddAttachment(GRUNT_ATTACHMENT_GUN_COMMANDER, MODEL_GUN_COMMANDER, TEXTURE_GUN_COMMANDER);
        GetModelObject()->StretchModel(FLOAT3D(STRETCH_COMMANDER, STRETCH_COMMANDER, STRETCH_COMMANDER));
        break;
    }
    ModelChangeNotify();

    // [Cecil] Increase health
    FLOAT fHealth = GetHealth();

    SetHealth(fHealth*2.0f);
    m_fMaxHealth = fHealth*2.0f;

    CEnemyBase::AdjustDifficulty();
  };

  // [Cecil] Drop weapons
  void DropItems(void) {
    if (IRnd() % 2) {
      CEntityPointer pen = SpawnWeapon();
      pen->Initialize();

      CWeaponItem *penWeapon = (CWeaponItem*)&*pen;
      penWeapon->m_bDropped = TRUE;
      penWeapon->m_bPickupOnce = TRUE;
      penWeapon->m_fDropTime = 20.0f;

      switch (m_gtType) {
        // 1/10 drops is AR2
        case CS_OVERWATCH: penWeapon->m_EwitType = (IRnd() % 10) ? WIT_SMG1 : WIT_AR2; break;
        case CS_PRISON: penWeapon->m_EwitType = WIT_SPAS; break;
      }

      pen->Reinitialize();
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

  void Precache(void) {
    CEnemyBase::Precache();
    
   if (m_gtType == CS_OVERWATCH) {
      PrecacheClass(CLASS_PROJECTILE, PRT_GRUNT_PROJECTILE_SOL);
    }
    if (m_gtType == CS_PRISON) {
      PrecacheClass(CLASS_PROJECTILE, PRT_GRUNT_PROJECTILE_COM);
    }

    PrecacheSound(SOUND_IDLE);
    PrecacheSound(SOUND_SIGHT);
    PrecacheSound(SOUND_WOUND);
    PrecacheSound(SOUND_DEATH);

    // [Cecil] New sounds
    PrecacheSound(SOUND_AR2);
    PrecacheSound(SOUND_SPAS1);
    PrecacheSound(SOUND_SPAS2);
  };

  /* Receive damage */
  void ReceiveDamage(CEntity *penInflictor, enum DamageType dmtType,
    FLOAT fDamageAmmount, const FLOAT3D &vHitPoint, const FLOAT3D &vDirection) 
  {
    // [Cecil] Ignore damage from allies
    if (IsOfClass(penInflictor, "CombineSoldier")) {
      return;
    }

    CEnemyBase::ReceiveDamage(penInflictor, dmtType, fDamageAmmount, vHitPoint, vDirection);
  };

  // damage anim
  INDEX AnimForDamage(FLOAT fDamage) {
    INDEX iAnim;
    iAnim = GRUNT_ANIM_WOUND01;
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
      iAnim = GRUNT_ANIM_DEATHBACKWARD;
    } else {
      iAnim = GRUNT_ANIM_DEATHFORWARD;
    }

    StartModelAnim(iAnim, 0);
    return iAnim;
  };

  FLOAT WaitForDust(FLOAT3D &vStretch) {
    vStretch=FLOAT3D(1, 1, 2);
    if(GetModelObject()->GetAnim()==GRUNT_ANIM_DEATHBACKWARD)
    {
      return 0.5f;
    }
    else if(GetModelObject()->GetAnim()==GRUNT_ANIM_DEATHFORWARD)
    {
      return 1.0f;
    }
    return -1.0f;
  };

  void DeathNotify(void) {
    ChangeCollisionBoxIndexWhenPossible(GRUNT_COLLISION_BOX_DEATH);
    en_fDensity = 500.0f;
  };

  // virtual anim functions
  void StandingAnim(void) {
    StartModelAnim(GRUNT_ANIM_IDLE, AOF_LOOPING|AOF_NORESTART);
  };
  void RunningAnim(void) {
    StartModelAnim(GRUNT_ANIM_RUN, AOF_LOOPING|AOF_NORESTART);
  };
    void WalkingAnim(void) {
    RunningAnim();
  };
  void RotatingAnim(void) {
    RunningAnim();
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

  // adjust sound and watcher parameters here if needed
  void EnemyPostInit(void) {
    // set sound default parameters
    m_soFire1.Set3DParameters(160.0f, 50.0f, 1.0f, 1.0f);
    m_soFire2.Set3DParameters(160.0f, 50.0f, 1.0f, 1.0f);
  };

procedures:
/************************************************************
 *                A T T A C K   E N E M Y                   *
 ************************************************************/
  Fire(EVoid) : CEnemyBase::Fire {
    // soldier
    if (m_gtType == CS_OVERWATCH) {
      autocall SoldierAttack() EEnd;
    // commander
    } else if (m_gtType == CS_PRISON) {
      autocall CommanderAttack() EEnd;
    // should never get here
    } else{
      ASSERT(FALSE);
    }
    return EReturn();
  };
    
  // Soldier attack
  SoldierAttack(EVoid) {
    StandingAnimFight();
    autowait(0.2f + FRnd()*0.25f);

    // [Cecil] Shoot 2 bullets
    StartModelAnim(GRUNT_ANIM_FIRE, 0);
    FireBullet(AR2_FIRE, 5.0f, 75.0f);
    PlaySound(m_soFire1, SOUND_AR2, SOF_3D);

    autowait(0.15f + FRnd()*0.1f);

    StartModelAnim(GRUNT_ANIM_FIRE, 0);
    FireBullet(AR2_FIRE, FLOAT(IRnd()%3) + 3.0f, 30.0f);
    PlaySound(m_soFire1, SOUND_AR2, SOF_3D);

    autowait(FRnd()*0.333f);
    return EEnd();
  };

  // Commander attack (predicted firing on moving player)
  CommanderAttack(EVoid) {
    StandingAnimFight();
    autowait(0.2f + FRnd()*0.25f);

    PlaySound(m_soFire1, SOUND_SPAS1 + IRnd()%2, SOF_3D);

    // [Cecil] Shoot 7 bullets
    StartModelAnim(GRUNT_ANIM_FIRE, 0);

    for (INDEX i = 0; i < 7; i++) {
      FireBullet(FIREPOS_COMMANDER, FLOAT(IRnd()%3) + 2.0f, 100.0f);
    }

    autowait(0.15f + FRnd()*0.5f);
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
    en_tmMaxHoldBreath = 5.0f;
    en_fDensity = 2000.0f;

    m_fBlowUpAmount = 1E10f; // [Cecil] Can't blow up

    // set your appearance
    SetModel(MODEL_GRUNT);

    switch (m_gtType) {
      case CS_OVERWATCH:
        // set your texture
        SetModelMainTexture(TEXTURE_SOLDIER);
        AddAttachment(GRUNT_ATTACHMENT_GUN_SMALL, MODEL_GUN_SOLDIER, TEXTURE_GUN_SOLDIER);
        // setup moving speed
        m_fWalkSpeed = FRnd() + 2.5f;
        m_aWalkRotateSpeed = AngleDeg(FRnd()*10.0f + 500.0f);
        m_fAttackRunSpeed = FRnd() + 6.5f;
        m_aAttackRotateSpeed = AngleDeg(FRnd()*50 + 245.0f);
        m_fCloseRunSpeed = FRnd() + 6.5f;
        m_aCloseRotateSpeed = AngleDeg(FRnd()*50 + 245.0f);
        // setup attack distances
        m_fAttackDistance = 80.0f;
        m_fCloseDistance = 0.0f;
        m_fStopDistance = 8.0f;
        m_fAttackFireTime = 2.0f;
        m_fCloseFireTime = 1.0f;
        m_fIgnoreRange = 200.0f;
        m_fBodyParts = 4;
        // [Cecil] 0 -> 20
        m_fDamageWounded = 20.0f;
        m_iScore = 500;
        SetHealth(40.0f);
        m_fMaxHealth = 40.0f;
        // set stretch factors for height and width
        GetModelObject()->StretchModel(FLOAT3D(STRETCH_SOLDIER, STRETCH_SOLDIER, STRETCH_SOLDIER));
        break;
  
      case CS_PRISON:
        // set your texture
        SetModelMainTexture(TEXTURE_COMMANDER);
        AddAttachment(GRUNT_ATTACHMENT_GUN_COMMANDER, MODEL_GUN_COMMANDER, TEXTURE_GUN_COMMANDER);
        // setup moving speed
        m_fWalkSpeed = FRnd() + 2.5f;
        m_aWalkRotateSpeed = AngleDeg(FRnd()*10.0f + 500.0f);
        m_fAttackRunSpeed = FRnd() + 8.0f;
        m_aAttackRotateSpeed = AngleDeg(FRnd()*50 + 245.0f);
        m_fCloseRunSpeed = FRnd() + 8.0f;
        m_aCloseRotateSpeed = AngleDeg(FRnd()*50 + 245.0f);
        // setup attack distances
        m_fAttackDistance = 90.0f;
        m_fCloseDistance = 0.0f;
        m_fStopDistance = 15.0f;
        m_fAttackFireTime = 4.0f;
        m_fCloseFireTime = 2.0f;
        m_fIgnoreRange = 200.0f;
        // damage/explode properties
        m_fBodyParts = 5;
        // [Cecil] 0 -> 30
        m_fDamageWounded = 30.0f;
        m_iScore = 800;
        SetHealth(60.0f);
        m_fMaxHealth = 60.0f;
        // set stretch factors for height and width
        GetModelObject()->StretchModel(FLOAT3D(STRETCH_COMMANDER, STRETCH_COMMANDER, STRETCH_COMMANDER));
        break;
    }

    ModelChangeNotify();
    StandingAnim();

    // [Cecil] Mark as HL2 enemy
    m_eHLEnemy = HLENEMY_BETA;

    // continue behavior in base class
    jump CEnemyBase::MainLoop();
  };
};
