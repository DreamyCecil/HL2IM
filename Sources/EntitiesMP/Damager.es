229
%{
#include "StdH.h"
%}

class CDamager: CRationalEntity {
name      "Damager";
thumbnail "Thumbnails\\Damager.tbn";
features  "HasName", "IsTargetable";

properties:
  1 CTString m_strName          "Name" 'N' = "Damager",
  2 CTString m_strDescription = "",
  3 enum DamageType m_dmtType "Type" 'Y' = DMT_ABYSS,    // type of damage
  4 FLOAT m_fAmmount "Ammount" 'A' = 1000.0f,             // ammount of damage
  5 CEntityPointer m_penToDamage "Entity to Damage" 'E',  // entity to damage, NULL to damage the triggerer
  6 BOOL m_bDamageFromTriggerer "DamageFromTriggerer" 'S' = FALSE,  // make the triggerer inflictor of the damage
 10 CEntityPointer m_penLastDamaged,
 11 FLOAT m_tmLastDamage = 0.0f,

components:
  1 model   MODEL_TELEPORT     "Models\\Editor\\Copier.mdl",
  2 texture TEXTURE_TELEPORT   "Models\\Editor\\Copier.tex",

functions:
  const CTString &GetDescription(void) const {
    return m_strDescription;
  }

procedures:
  Main()
  {
    InitAsEditorModel();
    SetPhysicsFlags(EPF_MODEL_IMMATERIAL);
    SetCollisionFlags(ECF_IMMATERIAL);

    // set appearance
    SetModel(MODEL_TELEPORT);
    SetModelMainTexture(TEXTURE_TELEPORT);

    ((CTString&)m_strDescription).PrintF("%s:%g", 
      DamageType_enum.NameForValue(INDEX(m_dmtType)), m_fAmmount);

    while (TRUE) {
      // wait for someone to trigger you and then damage it
      wait() {
        on (ETrigger eTrigger) : {

          CEntity *penInflictor = this;
          if (m_bDamageFromTriggerer) {
            penInflictor = eTrigger.penCaused;
          }

          CEntity *penVictim = NULL;
          if (m_penToDamage!=NULL) {
            penVictim = m_penToDamage;
          } else if (eTrigger.penCaused!=NULL) {
            penVictim = eTrigger.penCaused;
          }
 
          if (penVictim!=NULL) {
            if (!(penVictim==m_penLastDamaged && _pTimer->CurrentTick()<m_tmLastDamage+0.1f))
            {
            InflictDirectDamage(penVictim, penInflictor,  m_dmtType, m_fAmmount, 
              penVictim->GetPlacement().pl_PositionVector, FLOAT3D(0,1,0));
              m_penLastDamaged = penVictim;
              m_tmLastDamage = _pTimer->CurrentTick();
            }
          }
          stop;
        }
        otherwise() : {
          resume;
        };
      };
      
      // wait a bit to recover
      // autowait(0.1f);
    }
  }
};

