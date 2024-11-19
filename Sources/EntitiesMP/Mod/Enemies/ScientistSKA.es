340
%{
#include "StdH.h"

#include <Engine/Sound/SoundData.h>
#include <Engine/Templates/Stock_CSoundData.h>

#include "EntitiesMP/HealthItem.h"
%}

uses "EntitiesMP/EnemyBase";
uses "EntitiesMP/BasicEffects";

enum EScientistSkin {
  0 SCI_RANDOM "[Random]",
  1 SCI_1      "Dr. Bubby",
  2 SCI_2      "Dr. Coomer",
  3 SCI_3      "Dr. Darnold",
  4 SCI_4      "Tommy",
};

%{
// Info structure
static EntityInfo eiScientist = {
  EIBT_FLESH, 200.0f,
  0.0f, 1.6f, 0.0f, // source (eyes)
  0.0f, 1.0f, 0.0f, // target (body)
};

// Scientist folder
#define SCI_DIR "ModelsSKA\\Enemies\\Scientist\\"

// Scientists have been initialized
static BOOL _bScienceInit = FALSE;

// Scientist structure
static struct SScientistStructure {
  INDEX Mouth;
  INDEX Head;

  // Animation indices
  struct {
    INDEX TurnLeft;
    INDEX TurnRight;

    INDEX Greet;
    INDEX Sitting;
    INDEX StandUp;

    INDEX PullNeedle;
    INDEX GiveShot;
    INDEX ReturnNeedle;

    INDEX Idle[6];
    INDEX Run[3];
    INDEX Walk;
  } Anims;

  // Collision indices
  struct {
    INDEX Stand;
    INDEX Death;
  } Collision;
} _sci;

// Lists of sounds
static CDynamicStackArray<CTFileName> _aCasual;
static CDynamicStackArray<CTFileName> _aDamage;
static CDynamicStackArray<CTFileName> _aDeath;
static CDynamicStackArray<CTFileName> _aGreeting;
static CDynamicStackArray<CTFileName> _aHeal;
static CDynamicStackArray<CTFileName> _aWounded;

// Gather the science team
void InitScience(void) {
  if (_bScienceInit) {
    return;
  }

  // Build the scientist
  _sci.Mouth = ska_GetIDFromStringTable("Bone01");
  _sci.Head = ska_GetIDFromStringTable("Bip02 Head");

  _sci.Anims.TurnLeft = ska_GetIDFromStringTable("180_Left");
  _sci.Anims.TurnRight = ska_GetIDFromStringTable("180_Right");

  _sci.Anims.Greet = ska_GetIDFromStringTable("wave");
  _sci.Anims.Sitting = ska_GetIDFromStringTable("sitidle");
  _sci.Anims.StandUp = ska_GetIDFromStringTable("sitstand");

  _sci.Anims.PullNeedle = ska_GetIDFromStringTable("pull_needle");
  _sci.Anims.GiveShot = ska_GetIDFromStringTable("give_shot");
  _sci.Anims.ReturnNeedle = ska_GetIDFromStringTable("return_needle");

  for (INDEX iIdle = 0; iIdle < 6; iIdle++) {
    static const INDEX aiIdleIndex[6] = { 1, 3, 4, 5, 6, 7 };
    _sci.Anims.Idle[iIdle] = ska_GetIDFromStringTable(CTString(0, "idle%d", aiIdleIndex[iIdle]));
  }

  _sci.Anims.Run[0] = ska_GetIDFromStringTable("run");
  _sci.Anims.Run[1] = ska_GetIDFromStringTable("run1");
  _sci.Anims.Run[2] = ska_GetIDFromStringTable("run2");
  _sci.Anims.Walk = ska_GetIDFromStringTable("walk");

  _sci.Collision.Stand = ska_GetIDFromStringTable("Stand");
  _sci.Collision.Death = ska_GetIDFromStringTable("Death");

  // Sounds
  MakeDirList(_aCasual,   CTFILENAME(SCI_DIR "Sounds\\Casual\\"), "*.wav", 0);
  MakeDirList(_aDamage,   CTFILENAME(SCI_DIR "Sounds\\Damage\\"), "*.wav", 0);
  MakeDirList(_aDeath,    CTFILENAME(SCI_DIR "Sounds\\Death\\"), "*.wav", 0);
  MakeDirList(_aGreeting, CTFILENAME(SCI_DIR "Sounds\\Greeting\\"), "*.wav", 0);
  MakeDirList(_aHeal,     CTFILENAME(SCI_DIR "Sounds\\Heal\\"), "*.wav", 0);
  MakeDirList(_aWounded,  CTFILENAME(SCI_DIR "Sounds\\Wounded\\"), "*.wav", 0);

  _bScienceInit = TRUE;
};

CTFileName RandomSound(CDynamicStackArray<CTFileName> &aSounds, CEntity *pen) {
  INDEX ct = aSounds.Count();

  if (ct <= 0) {
    return CTString("Sounds\\Default.wav");
  }

  return aSounds[pen->IRnd() % ct];
};
%}

class CScientistSKA : CEnemyBase {
name      "Scientist";
thumbnail "Thumbnails\\Mental.tbn";

properties:
  // [Cecil] NOTE: Don't add new properties with 1-9 indices, so they don't overlap with BigHead properties
  3 FLOAT m_tmLastGreetTime = -100.0f,
  7 BOOL m_bSitting "Sitting" 'S' = FALSE,

 10 FLOAT m_fMouthTalk = 0.0f,
 11 FLOAT m_fMouthTalkLast = 0.0f,
 12 FLOAT m_fTalkLevel = 0.0f,
 13 FLOAT m_fToPlayer = 0.0f,
 14 FLOAT m_fToPlayerLast = 0.0f,

 15 BOOL m_bGreeting "Greet the player" = TRUE,

 20 CEntityPointer m_penStep,
 21 CEntityPointer m_penLastPlayer,
 22 FLOAT m_tmLastPlayerDamage = -100.0f,
 24 BOOL m_bStoodUp = TRUE, // Set to FALSE if m_bSitting is FALSE

 30 FLOAT m_tmPhraseStart = -100.0f, // When started talking
 31 FLOAT m_tmPhraseLength = 0.0f, // Phrase sound length

 40 enum EScientistSkin m_eType "Type" 'Y' = SCI_RANDOM,
 41 INDEX m_iSkinType = -1, // Selected skin type (because random isn't a valid type)

{
  CAutoPrecacheSound m_aps;
}

components:
  1 class   CLASS_BASE            "Classes\\EnemyBase.ecl",
  2 class   CLASS_BLOOD_SPRAY     "Classes\\BloodSpray.ecl",
  3 class   CLASS_BASIC_EFFECT    "Classes\\BasicEffect.ecl",

functions:
  // Constructor
  void CScientistSKA(void) {
    InitScience();
  };

  // Change from MDL to SKA
  void Read_t(CTStream *istr) {
    CEnemyBase::Read_t(istr);

    if (GetRenderType() != RT_SKAMODEL) {
      en_fSpatialClassificationRadius = -1.0f;
      en_boxSpatialClassification = FLOATaabbox3D();

      delete en_pmoModelObject;
      delete en_psiShadingInfo;
      DiscardCollisionInfo();
      en_pmoModelObject = NULL;
      en_psiShadingInfo = NULL;
      CreateScientist(TRUE);
    }
  };

  void Precache(void) {
    CEnemyBase::Precache();

    // Precache all sounds
    CDynamicStackArray<CTFileName> aSounds;
    MakeDirList(aSounds, CTFILENAME(SCI_DIR "Sounds\\"), "*.wav", DLI_RECURSIVE);

    for (INDEX iSound = 0; iSound < aSounds.Count(); iSound++) {
      m_aps.Precache(aSounds[iSound]);
    }
  };

  void *GetEntityInfo(void) {
    return &eiScientist;
  };

  // Ignore player touches
  BOOL HandleEvent(const CEntityEvent &ee) {
    if (ee.ee_slEvent == EVENTCODE_ETouch) {
      const ETouch &eTouch = (const ETouch &)ee;
      if (IS_PLAYER(eTouch.penOther)) { return TRUE; }
    }

    return CEnemyBase::HandleEvent(ee);
  };

  // Adjust light direction to be at an absolute angle instead of relative
  BOOL AdjustShadingParameters(FLOAT3D &vLightDirection, COLOR &colLight, COLOR &colAmbient) {
    ANGLE3D aLight;
    DirectionVectorToAngles(vLightDirection, aLight);

    ANGLE3D aDelta = aLight - GetLerpedPlacement().pl_OrientationAngle;
    AnglesToDirectionVector(aDelta, vLightDirection);

    return CEnemyBase::AdjustShadingParameters(vLightDirection, colLight, colAmbient);
  };

  // Get main scientist model
  virtual CModelInstance *GetMainModelInstance(void) {
    return GetModelInstance()->mi_cmiChildren.Pointer(0);
  };

  // Get needle model
  CModelInstance *GetNeedleModel(void) {
    return GetModelInstance()->mi_cmiChildren.Pointer(1);
  };

  // Toggle needle model
  void ToggleNeedle(BOOL bShow) {
    if (bShow) {
      GetNeedleModel()->StretchModel(FLOAT3D(1, 1, 1));
    } else {
      GetNeedleModel()->StretchModel(FLOAT3D(0, 0, 0));
    }
  };

  // Apply animation to all attached models
  void AddAnimation(INDEX iAnimID, DWORD dwFlags, FLOAT fStrength, INDEX iGroupID, FLOAT fSpeedMul) {
    GetMainModelInstance()->AddAnimation(iAnimID, dwFlags, fStrength, iGroupID, fSpeedMul);
    GetNeedleModel()->AddAnimation(iAnimID, dwFlags, fStrength, iGroupID, fSpeedMul);

    // Hide needle on any non-healing animation (if healing has been interrupted)
    if (iAnimID != _sci.Anims.PullNeedle
     && iAnimID != _sci.Anims.GiveShot
     && iAnimID != _sci.Anims.ReturnNeedle) {
      ToggleNeedle(FALSE);
    }
  };

  void AdjustBones(void) {
    // Move mouth when talking
    RenBone *rb = RM_FindRenBone(_sci.Mouth);

    if (rb != NULL) {
      FLOATquat3D quat;

      FLOAT fAngle = Lerp(m_fMouthTalkLast, m_fMouthTalk, _pTimer->GetLerpFactor());
      quat.FromEuler(ANGLE3D(0.0f, 0.0f, fAngle - 100.0f));

      rb->rb_arRot.ar_qRot = quat;
    }

    // Turn head towards the player
    if (GetFlags() & ENF_ALIVE) {
      rb = RM_FindRenBone(_sci.Head);

      if (rb != NULL) {
        FLOATquat3D quat;

        FLOAT fAngle = Lerp(m_fToPlayerLast, m_fToPlayer, _pTimer->GetLerpFactor());
        quat.FromEuler(ANGLE3D(0.0f, fAngle, 0.0f));

        rb->rb_arRot.ar_qRot = quat;
      }
    }
  };

  // Mouth animations
  virtual void OnStep(void) {
    m_fMouthTalkLast = m_fMouthTalk;

    FLOAT fDiff = m_fTalkLevel - m_fMouthTalk;
    FLOAT fMaxSpeed = (IsDamaged(0.3f) ? 6.0f : 3.0f);

    m_fMouthTalk += Min(Abs(fDiff), fMaxSpeed) * Sgn(fDiff);

    if (Abs(m_fTalkLevel - m_fMouthTalk) <= 0.0001f) {
      if (IsTalking()) {
        m_fTalkLevel = FRnd() * (IsDamaged(0.3f) ? 16.0f : 12.0f);

      } else {
        m_fTalkLevel = 0.0f;
      }
    }

    if (m_penLastPlayer != NULL) {
      m_fToPlayerLast = m_fToPlayer;

      FLOAT fFacePlayer = 0.0f;

      if (IsTalking()) {
        fFacePlayer = Clamp(FacingPlayer(), -35.0f, 35.0f);
      }

      fDiff = fFacePlayer - m_fToPlayer;
      m_fToPlayer += Min(Abs(fDiff), 15.0f) * Sgn(fDiff);
    }

    // Reset sound length
    if (!IsTalking()) {
      m_tmPhraseLength = 0.0f;
    }
  };

  // Interact with a player
  void OnInteract(CPlayer *penPlayer) {
    m_penLastPlayer = penPlayer;

    // Get up
    if (!m_bStoodUp) {
      if (m_bSitting) {
        ETrigger eTrigger;
        eTrigger.penCaused = penPlayer;
        SendEvent(eTrigger);
      }

      return;
    }

    // Recently damaged
    if (IsDamaged(5.0f) && m_penLastAttacker == penPlayer) {
      Say(RandomSound(_aWounded, this));

      m_bGreeting = FALSE;
      return;
    }

    const BOOL bCanHeal = CanHealPlayer(penPlayer);

    // Face the player only if can heal or not walking towards any marker
    if (bCanHeal || (Abs(FacingPlayer()) > 35.0f && m_penMarker == NULL)) {
      SetTargetHardForce(penPlayer);
      SendEvent(EReconsiderBehavior());
    }

    // Heal request
    if (bCanHeal) {
      Say(RandomSound(_aHeal, this));

    // First time greeting
    } else if (m_bGreeting) {
      Say(RandomSound(_aGreeting, this));

    // Casual talk
    } else {
      Say(RandomSound(_aCasual, this));
    }

    m_bGreeting = FALSE;
  };

  // Say a certain phrase
  void Say(const CTFileName &fnSound) {
    if (!IsTalking()) {
      PlaySound(m_soSound, fnSound, SOF_3D);
      m_tmLastPlayerDamage = -100.0f;

      m_tmPhraseStart = _pTimer->CurrentTick();
      m_tmPhraseLength = GetPhraseLength(fnSound);
    }
  };

  // Get length of a sound file
  FLOAT GetPhraseLength(const CTFileName &fnSound) {
    CSoundData *psd = _pSoundStock->Obtain_t(fnSound);
    FLOAT fLength = psd->GetSecondsLength();
    _pSoundStock->Release(psd);

    return fLength;
  };

  // Check if talking right now
  BOOL IsTalking(void) {
    return _pTimer->CurrentTick() - m_tmPhraseStart < m_tmPhraseLength;
  };

  // Check if have been damaged within a certain time recently
  BOOL IsDamaged(FLOAT fThreshold) {
    return (_pTimer->CurrentTick() - m_tmLastPlayerDamage < fThreshold);
  };

  // Get relative facing angle towards the player
  FLOAT FacingPlayer(void) {
    FLOAT3D vToPlayer = (m_penLastPlayer->GetPlacement().pl_PositionVector - GetPlacement().pl_PositionVector).Normalize();
    return GetRelativeHeading(vToPlayer);
  };

  INDEX AnimForDamage(FLOAT fDamage) {
    INDEX iAnim = ska_GetIDFromStringTable("flinch1");
    AddAnimation(iAnim, AN_CLEAR, 1, 0, 1.0f);
    return iAnim;
  };

  INDEX AnimForDeath(void) {
    INDEX iAnimDeath;
    FLOAT3D vFront;
    GetHeadingDirection(0, vFront);

    if (m_vDamage % vFront < 0.0f) {
      iAnimDeath = ska_GetIDFromStringTable("diebackward");
    } else {
      iAnimDeath = ska_GetIDFromStringTable("dieforward");
    }

    AddAnimation(iAnimDeath, AN_CLEAR, 1, 0, 1.0f);
    return iAnimDeath;
  };

  void DeathNotify(void) {
    INDEX iBoxIndex = GetMainModelInstance()->GetColisionBoxIndex(_sci.Collision.Death);
    ChangeCollisionBoxIndexWhenPossible(iBoxIndex);

    en_fDensity = 500.0f;

    // Remove the reminder
    if (m_penStep != NULL) {
      m_penStep->Destroy();
    }

    m_fMouthTalkLast = 10.0f;
    m_fMouthTalk = 10.0f;
  };

  // Can't be blown up
  BOOL ShouldBlowUp(void) {
    return FALSE;
  };

  void StandingAnim(void) {
    INDEX iAnim = _sci.Anims.Idle[0];
    AddAnimation(iAnim, AN_CLEAR|AN_LOOPING, 1, 0, 1.0f);
  };

  void WalkingAnim(void) {
    AddAnimation(_sci.Anims.Walk, AN_CLEAR|AN_LOOPING|AN_NORESTART, 1, 0, 1.0f);
  };

  void RunningAnim(void) {
    AddAnimation(_sci.Anims.Run[0], AN_CLEAR|AN_LOOPING|AN_NORESTART, 1, 0, 1.0f);
  };

  void RotatingAnim(void) {
    FLOAT fRotation = GetDesiredRotation()(1);
    INDEX iTurnAnim = (fRotation > 0.0f ? _sci.Anims.TurnLeft : _sci.Anims.TurnRight);

    AddAnimation(iTurnAnim, AN_CLEAR|AN_LOOPING, 1, 0, 1.0f);
  };

  void IdleSound(void) {};
  void SightSound(void) {};

  void WoundSound(void) {
    if (!IsDamaged(0.3f)) {
      CTFileName fnSound = RandomSound(_aDamage, this);

      PlaySound(m_soSound, fnSound, SOF_3D);
      m_tmLastPlayerDamage = _pTimer->CurrentTick();

      m_tmPhraseStart = _pTimer->CurrentTick();
      m_tmPhraseLength = GetPhraseLength(fnSound);
    }
  };

  void DeathSound(void) {
    PlaySound(m_soSound, RandomSound(_aDeath, this), SOF_3D);
  };

  virtual FLOAT GetAttackMoveFrequency(FLOAT fEnemyDistance) {
    return 0.1f;
  };

  // Create the scientist
  void CreateScientist(BOOL bSetFlags) {
    InitAsSkaModel();

    if (bSetFlags) {
      SetPhysicsFlags(EPF_MODEL_WALKING|EPF_HASLUNGS);
      SetCollisionFlags(ECF_MODEL);
      SetFlags(GetFlags()|ENF_ALIVE);
    }

    SetHealth(200.0f);
    m_fMaxHealth = 200.0f;

    en_tmMaxHoldBreath = 5.0f;
    en_fDensity = 2000.0f;
    m_fBlowUpSize = 2.0f;

    // Set appearance
    m_iSkinType = Clamp((INDEX)m_eType, (INDEX)1, (INDEX)4);

    if (m_eType == SCI_RANDOM) {
      m_iSkinType = (IRnd() % 4) + 1;
    }

    SetSkaModel(CTString(SCI_DIR "Center.smc"));

    CModelInstance *pmiScientist = NULL;
    CModelInstance *pmiNeedle = NULL;

    try{
      pmiScientist = ParseSmcFile_t(CTString(0, SCI_DIR "Scientist%d.smc", m_iSkinType));
      pmiNeedle = ParseSmcFile_t(CTString(0, SCI_DIR "Needle%d.smc", (m_iSkinType != SCI_3) ? 1 : 2));

    } catch (char *strError) {
      FatalError(strError);
    }

    GetModelInstance()->AddChild(pmiScientist);
    GetModelInstance()->AddChild(pmiNeedle);

    ToggleNeedle(FALSE);

    // Moving speed
    m_fWalkSpeed = FRnd() + 1.5f;
    m_aWalkRotateSpeed = 500.0f;
    m_fAttackRunSpeed = FRnd()*2.0f + 6.0f;
    m_aAttackRotateSpeed = 500.0f;
    m_fCloseRunSpeed = FRnd()*2.0f + 6.0f;
    m_aCloseRotateSpeed = 500.0f;

    // Attack distances
    m_fAttackDistance = 50.0f;
    m_fCloseDistance = 0.0f;
    m_fStopDistance = 2.0f;
    m_fAttackFireTime = 0.1f;
    m_fCloseFireTime = 0.1f;
    m_fIgnoreRange = 200.0f;

    // Damage properties
    m_fBlowUpAmount = 65.0f;
    m_fBodyParts = 4;
    m_fDamageWounded = 1.0f;
    m_iScore = 0;

    m_bBlind = TRUE;
    m_bDeaf = TRUE;
    m_fSenseRange = 0;

    GetModelInstance()->StretchModel(FLOAT3D(2, 2, 2));
    CEnemyBase::SizeModel();
    ModelChangeNotify();

    StandingAnim();
  };

  // Check if can heal some player
  BOOL CanHealPlayer(CEntity *penPlayer) {
    if (IS_PLAYER(penPlayer)) {
      return ((CPlayer &)*penPlayer).GetHealth() < 95.0f;
    }

    return FALSE;
  };

procedures:
  Fire() : CEnemyBase::Fire {
    if (CalcDist(m_penEnemy) <= m_fStopDistance * 1.1f) {
      m_bBlind = TRUE;
      m_bDeaf = TRUE;
      m_fSenseRange = 0.0f;
      m_tmLastGreetTime = _pTimer->CurrentTick();

      if (CanHealPlayer(m_penEnemy)) {
        // Pull out the needle
        INDEX iAnim = _sci.Anims.PullNeedle;
        AddAnimation(iAnim, AN_CLEAR, 1, 0, 1.0f);
        autowait(GetAnimLength(iAnim) - 0.8f);

        ToggleNeedle(TRUE);
        autowait(0.8f);

        // Give the health shot
        INDEX iAnim = _sci.Anims.GiveShot;
        AddAnimation(iAnim, AN_CLEAR, 1, 0, 1.0f);
        autowait(GetAnimLength(iAnim) - 0.5f);

        // Safety check
        if (CalcDist(m_penEnemy) <= m_fStopDistance * 1.1f && IS_PLAYER(m_penEnemy)) {
          EHealth eHealth;
          eHealth.fHealth = 10.0f;
          eHealth.bOverTopHealth = FALSE;

          m_penEnemy->ReceiveItem(eHealth);
        }

        autowait(0.5f);

        // Put away the needle
        INDEX iAnim = _sci.Anims.ReturnNeedle;
        AddAnimation(iAnim, AN_CLEAR, 1, 0, 1.0f);
        autowait(GetAnimLength(iAnim) - 0.5f);

        ToggleNeedle(FALSE);
        autowait(0.5f);

      } else if (TRUE) {
        StandingAnim();
        autowait(ClampDn(m_tmPhraseLength, ONE_TICK));
      }

      SetTargetNone();
      return EReconsiderBehavior();
    }

    return EReturn();
  };

  Sleep(EVoid) {
    AddAnimation(_sci.Anims.Sitting, AN_CLEAR|AN_LOOPING, 1, 0, 1.0f);
    m_bStoodUp = FALSE;

    wait() {
      on (ETrigger) : { jump WakeUp(); }
      on (EDeath) : { pass; }
      otherwise() : { resume; }
    }
  };

  WakeUp(EVoid) {
    m_bSitting = FALSE;

    INDEX iAnim = _sci.Anims.StandUp;
    AddAnimation(iAnim, AN_CLEAR, 1, 0, 1.0f);
    autowait(GetAnimLength(iAnim));

    m_bStoodUp = TRUE;
    return EReturn();
  };

  PreMainLoop(EVoid) : CEnemyBase::PreMainLoop {
    // Create a reminder
    m_penStep = SpawnReminder(this, ONE_TICK, ENEMY_STEP_VAL, TRUE);

    if (m_bSitting) {
      wait() {
        on (EBegin) : { call Sleep(); }
        on (EReturn) : { stop; }
        on (EDeath eDeath) : { jump CEnemyBase::Die(eDeath); }
      }
    }

    return EReturn();
  };

  Main(EVoid) {
    CreateScientist(TRUE);
    jump CEnemyBase::MainLoop();
  };
};
