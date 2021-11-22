406
%{
#include "StdH.h"
"
%}

uses "EntitiesMP/ExotechLarva";

// input parameter for animator
event EAnimatorInit {
  CEntityPointer penPlayer,            // player owns it
};

%{
// animator action
enum LarvaAction {
  LA_JUMPDOWN = 0,
  LA_CROUCH,
};
%}

class export CExotechLarvaAnimator: CRationalEntity {
name      "ExotechLarvaAnimator";
thumbnail "";
features  "CanBePredictable";

properties:
  1 CEntityPointer m_penLarva,                // larva which owns it

functions:
  
  void Precache(void)
  {
    INDEX iAvailableWeapons = ((CPlayerWeapons&)*(((CPlayer&)*m_penPlayer).m_penWeapons)).m_iAvailableWeapons;
    CPlayerAnimator_Precache(iAvailableWeapons);
  }
  
  CExotechLarva *GetLarva(void)
  {
    return ((CExotechLarva*)&*m_penLarva);
  }


/************************************************************
 *                      PROCEDURES                          *
 ************************************************************/
procedures:
  ReminderAction(EReminder er) {
    switch (er.iValue) {
      case AA_JUMPDOWN: m_bWaitJumpAnim = FALSE; break;
      case AA_CROUCH: m_iCrouchDownWait--; ASSERT(m_iCrouchDownWait>=0); break;
      case AA_RISE: m_iRiseUpWait--; ASSERT(m_iRiseUpWait>=0); break;
      case AA_PULLWEAPON: m_bChangeWeapon = FALSE; break;
      case AA_ATTACK: if(m_tmAttackingDue<=_pTimer->CurrentTick()) { m_bAttacking = FALSE; } break;
      default: ASSERTALWAYS("Animator - unknown reminder action.");
    }
    return EBegin();
  };

  Main(EAnimatorInit eInit) {
    // remember the initial parameters
    ASSERT(eInit.penPlayer!=NULL);
    m_penPlayer = eInit.penPlayer;

    // declare yourself as a void
    InitAsVoid();
    SetFlags(GetFlags()|ENF_CROSSESLEVELS);
    SetPhysicsFlags(EPF_MODEL_IMMATERIAL);
    SetCollisionFlags(ECF_IMMATERIAL);

    // last action time for boring weapon animation
    m_fLastActionTime = _pTimer->CurrentTick();

    wait() {
      on (EBegin) : { resume; }
      on (EReminder er) : { call ReminderAction(er); }
      on (EEnd) : { stop; }
    }

    // cease to exist
    Destroy();

    return;
  };
};

