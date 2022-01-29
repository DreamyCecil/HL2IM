344
%{
#include "StdH.h"
#include "ModelsMP/Enemies/Guffy/Guffy.h"
%}

uses "EntitiesMP/EnemyBase";
uses "EntitiesMP/Projectile";

%{
// info structure
static EntityInfo eiElite = {
  EIBT_FLESH, 800.0f,
  0.0f, 1.9f, 0.0f,     // source (eyes)
  0.0f, 1.0f, 0.0f,     // target (body)
};

// [Cecil] Different positions
#define FIRE_LEFT_ARM   FLOAT3D(-0.25f, +1.125f, -0.5f)
#define FIRE_RIGHT_ARM  FLOAT3D(+0.25f, +1.060f, -0.5f)
%}

class CCombineElite : CEnemyBase {
name      "CombineElite";
thumbnail "Thumbnails\\Guffy.tbn";

properties:
  2 INDEX m_iLoopCounter = 0,
  3 FLOAT m_fSize = 1.0f,
  4 BOOL  m_bWalkSoundPlaying = FALSE,
  5 FLOAT m_fThreatDistance = 5.0f,

 10 CSoundObject m_soFire1,
 11 CSoundObject m_soFire2,
  
components:
  0 class CLASS_BASE       "Classes\\EnemyBase.ecl",
  1 class CLASS_PROJECTILE "Classes\\Projectile.ecl",

 10 model   MODEL_GUFFY   "Models\\Enemies\\CombineElite\\CombineElite.mdl",
 11 texture TEXTURE_GUFFY "Models\\Enemies\\CombineElite\\CombineElite.tex",
 12 model   MODEL_GUN     "Models\\Enemies\\CombineElite\\Gun.mdl",
 13 texture TEXTURE_GUN   "Models\\Enemies\\CombineElite\\Gun.tex",

// ************** SOUNDS **************
 40 sound SOUND_IDLE  "Models\\Enemies\\CombineElite\\Sounds\\Idle.wav",
 41 sound SOUND_SIGHT "Models\\Enemies\\CombineElite\\Sounds\\Sight.wav",
 43 sound SOUND_FIRE  "Models\\Enemies\\CombineElite\\Sounds\\Fire.wav",
 44 sound SOUND_WOUND "Models\\Enemies\\CombineElite\\Sounds\\Wound.wav",
 45 sound SOUND_DEATH "Models\\Enemies\\CombineElite\\Sounds\\Death.wav",

functions:
  // describe how this enemy killed player
  virtual CTString GetPlayerKillDescription(const CTString &strPlayerName, const EDeath &eDeath) {
    CTString str;
    str.PrintF(TRANS("%s has been dissolved by an Overwatch Elite soldier"), strPlayerName);
    return str;
  };

  virtual const CTFileName &GetComputerMessageName(void) const {
    static DECLARE_CTFILENAME(fnmSoldier, "Data\\Messages\\Enemies\\CombineElite.txt");
    return fnmSoldier;
  };

  void Precache(void) {
    CEnemyBase::Precache();
    
    // guffy
    PrecacheModel(MODEL_GUFFY);
    PrecacheTexture(TEXTURE_GUFFY);

    // weapon
    PrecacheModel(MODEL_GUN);
    PrecacheTexture(TEXTURE_GUN);

    // sounds
    PrecacheSound(SOUND_IDLE);
    PrecacheSound(SOUND_SIGHT);
    PrecacheSound(SOUND_DEATH);
    PrecacheSound(SOUND_FIRE);
    PrecacheSound(SOUND_WOUND);
    
    // projectile
    PrecacheClass(CLASS_PROJECTILE, PRT_GUFFY_PROJECTILE);
  };

  // Entity info
  void *GetEntityInfo(void) {
    return &eiElite;
  };

  // Receive damage
  void ReceiveDamage(CEntity *penInflictor, enum DamageType dmtType,
    FLOAT fDamageAmmount, const FLOAT3D &vHitPoint, const FLOAT3D &vDirection) {
    // Combine elite can't harm combine elite
    if (!IsOfClass(penInflictor, "CombineElite")) {
      CEnemyBase::ReceiveDamage(penInflictor, dmtType, fDamageAmmount, vHitPoint, vDirection);
    }
  };

  // virtual anim functions
  void StandingAnim(void) {
    StartModelAnim(GUFFY_ANIM_IDLE, AOF_LOOPING|AOF_NORESTART);
  };

  void RunningAnim(void) {
    StartModelAnim(GUFFY_ANIM_RUN, AOF_LOOPING|AOF_NORESTART);
  };

  void WalkingAnim(void) {
    RunningAnim();
  };

  void RotatingAnim(void) {
    StartModelAnim(GUFFY_ANIM_RUN, AOF_LOOPING|AOF_NORESTART);
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
    m_soSound.Set3DParameters(160.0f, 50.0f, 1.0f, 1.0f);
    m_soFire1.Set3DParameters(160.0f, 50.0f, 1.0f, 1.0f);
    m_soFire2.Set3DParameters(160.0f, 50.0f, 1.0f, 1.0f);
  };

  // damage anim
  INDEX AnimForDamage(FLOAT fDamage) {
    INDEX iAnim;
    iAnim = GUFFY_ANIM_WOUND;
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
      iAnim = GUFFY_ANIM_DEATHBACKWARD;
    } else {
      iAnim = GUFFY_ANIM_DEATHFORWARD;
    }

    StartModelAnim(iAnim, 0);
    return iAnim;
  };

  // death
  FLOAT WaitForDust(FLOAT3D &vStretch) {
    vStretch = FLOAT3D(1.0f, 1.0f, 2.0f)*1.5f;

    if (GetModelObject()->GetAnim() == GUFFY_ANIM_DEATHBACKWARD) {
      return 0.48f;
    } else if(GetModelObject()->GetAnim() == GUFFY_ANIM_DEATHFORWARD) {
      return 1.0f;
   }
    return -1.0f;
  };

  // [Cecil] Reload the model
  void AdjustDifficulty(void) {
    SetModel(MODEL_GUFFY);
    m_fSize = 1.5f;
    SetModelMainTexture(TEXTURE_GUFFY);
    AddAttachment(GUFFY_ATTACHMENT_GUNRIGHT, MODEL_GUN, TEXTURE_GUN);
    AddAttachment(GUFFY_ATTACHMENT_GUNLEFT, MODEL_GUN, TEXTURE_GUN);
    GetModelObject()->StretchModel(FLOAT3D(m_fSize, m_fSize, m_fSize));
    ModelChangeNotify();
    CModelObject *pmoRight = &GetModelObject()->GetAttachmentModel(GUFFY_ATTACHMENT_GUNRIGHT)->amo_moModelObject;
    pmoRight->StretchModel(FLOAT3D(-1,1,1));

    CEnemyBase::AdjustDifficulty();
  };

  // [Cecil] Drop weapons
  void DropItems(void) {
    if (IRnd() % 2) {
      // either AR2 or alt ammo
      if (IRnd() % 4) {
        CEntityPointer pen = SpawnWeapon();
        pen->Initialize();

        CWeaponItem *penWeapon = (CWeaponItem*)&*pen;
        penWeapon->m_EwitType = WIT_AR2;
        penWeapon->m_bDropped = TRUE;
        penWeapon->m_bPickupOnce = TRUE;
        penWeapon->m_fDropTime = 20.0f;
        pen->Reinitialize();

      } else {
        CEntityPointer pen = SpawnPowerUp();
        pen->Initialize();

        CPowerUpItem *penPower = (CPowerUpItem*)&*pen;
        penPower->m_bDropped = TRUE;
        penPower->m_bPickupOnce = TRUE;
        penPower->m_fDropTime = 30.0f;
        pen->Reinitialize();
      }
    }
  };

procedures:
/************************************************************
 *                A T T A C K   E N E M Y                   *
 ************************************************************/
  Fire(EVoid) : CEnemyBase::Fire {
    StartModelAnim(GUFFY_ANIM_FIRE, AOF_LOOPING);
    
    // wait for animation to bring the left hand into firing position
    autowait(0.1f);

    // [Cecil] Launch an energy ball
    ShootProjectile(PRT_ENERGY_BALL, FIRE_RIGHT_ARM*m_fSize, ANGLE3D(0, 0, 0));
    PlaySound(m_soFire1, SOUND_FIRE, SOF_3D);
    
    autowait(1.0f);
    
    StopMoving();
    MaybeSwitchToAnotherPlayer();

    // wait for a while
    StandingAnimFight();
    autowait(FRnd()*0.25f+0.25f);

    return EReturn();
  };

/************************************************************
 *                       M  A  I  N                         *
 ************************************************************/
  Main(EVoid) {
    // declare yourself as a model
    InitAsModel();
    SetPhysicsFlags(EPF_MODEL_WALKING);
    SetCollisionFlags(ECF_MODEL);
    SetFlags(GetFlags()|ENF_ALIVE);
    SetHealth(210.0f);
    m_fMaxHealth = 210.0f;
    en_fDensity = 2000.0f;

    // set your appearance
    SetModel(MODEL_GUFFY);
    m_fSize = 1.5f;
    SetModelMainTexture(TEXTURE_GUFFY);
    AddAttachment(GUFFY_ATTACHMENT_GUNRIGHT, MODEL_GUN, TEXTURE_GUN);
    AddAttachment(GUFFY_ATTACHMENT_GUNLEFT, MODEL_GUN, TEXTURE_GUN);
    GetModelObject()->StretchModel(FLOAT3D(m_fSize, m_fSize, m_fSize));
    ModelChangeNotify();
    CModelObject *pmoRight = &GetModelObject()->GetAttachmentModel(GUFFY_ATTACHMENT_GUNRIGHT)->amo_moModelObject;
    pmoRight->StretchModel(FLOAT3D(-1,1,1));
    m_fBlowUpAmount = 1E10f; // [Cecil] Can't blow up
    m_iScore = 3000;
    //m_fThreatDistance = 15;
    
    if (m_fStepHeight==-1) {
      m_fStepHeight = 4.0f;
    }

    StandingAnim();
    // setup moving speed
    m_fWalkSpeed = FRnd() + 2.5f;
    m_aWalkRotateSpeed = AngleDeg(FRnd()*10.0f + 500.0f);
    m_fAttackRunSpeed = FRnd() + 5.0f;
    m_aAttackRotateSpeed = AngleDeg(FRnd()*50 + 245.0f);
    m_fCloseRunSpeed = FRnd() + 5.0f;
    m_aCloseRotateSpeed = AngleDeg(FRnd()*50 + 245.0f);
    // setup attack distances
    m_fAttackDistance = 150.0f;
    m_fCloseDistance = 0.0f;
    m_fStopDistance = 25.0f;
    m_fAttackFireTime = 5.0f;
    m_fCloseFireTime = 5.0f;
    m_fIgnoreRange = 250.0f;
    // damage/explode properties
    m_fBodyParts = 5;
    m_fDamageWounded = 100.0f;

    // [Cecil] Mark as HL2 enemy
    m_bHL2Enemy = TRUE;

    // continue behavior in base class
    jump CEnemyBase::MainLoop();
  };
};
