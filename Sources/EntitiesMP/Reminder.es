703
%{
#include "StdH.h"

// [Cecil] Reminder flags
#define RMF_FIRSTTIME (1 << 0)
#define RMF_LOOPED    (1 << 1)
%}

// input parameter for timer
event EReminderInit {
  CEntityPointer penOwner,    // who owns it
  FLOAT fWaitTime,            // wait time
  INDEX iValue,               // reminder event value
  BOOL bLooped, // [Cecil] Loop the reminder
};

class export CReminder : CRationalEntity {
name      "Reminder";
thumbnail "";

properties:
  1 CEntityPointer m_penOwner,    // entity which owns it
  2 FLOAT m_fWaitTime = 0.0f,     // wait time
  3 INDEX m_iValue = 0,           // reminder event value

  // [Cecil]
  5 INDEX m_iFlags = RMF_FIRSTTIME, // Reminder flags

components:
functions:
procedures:
  Main(EReminderInit eri) {
    // remember the initial parameters
    ASSERT(eri.penOwner!=NULL);
    m_penOwner = eri.penOwner;
    m_fWaitTime = eri.fWaitTime;
    m_iValue = eri.iValue;

    // [Cecil] Set looped flag
    if (eri.bLooped) {
      m_iFlags |= RMF_LOOPED;
    }
    
    // init as nothing
    InitAsVoid();
    SetPhysicsFlags(EPF_MODEL_IMMATERIAL);
    SetCollisionFlags(ECF_IMMATERIAL);

    // wait
    if (m_fWaitTime > 0.0f) {
      // [Cecil] Keep going if looped
      while (m_iFlags & (RMF_LOOPED|RMF_FIRSTTIME)) {
        autowait(m_fWaitTime);

        EReminder er;
        er.iValue = m_iValue;

        if (m_penOwner != NULL) {
          m_penOwner->SendEvent(er);
        }

        // [Cecil] First pass has expired
        m_iFlags &= ~RMF_FIRSTTIME;
      }
    }

    // cease to exist
    Destroy();

    return;
  };
};