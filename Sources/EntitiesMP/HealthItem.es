801
%{
#include "StdH.h"
#include "Models/Items/ItemHolder/ItemHolder.h"

// [Cecil] Half-Life 2 Health
#include "HL2Models/VitalHandler.h"
%}

uses "EntitiesMP/Item";

// health type 
enum HealthItemType {
  0 HIT_PILL      "Pill",       // pill health
  1 HIT_SMALL     "Small",      // small health
  2 HIT_MEDIUM    "Medium",     // medium health
  3 HIT_LARGE     "Large",      // large health
  4 HIT_SUPER     "Super",      // super health
};

// event for sending through receive item
event EHealth {
  FLOAT fHealth,        // health to receive
  BOOL bOverTopHealth,  // can be received over top health
};

%{
// [Cecil] Extracted from entity functions
void CHealthItem_Precache(void) {
  CDLLEntityClass *pdec = &CHealthItem_DLLClass;

  pdec->PrecacheModel(MODEL_HANDLER);
  pdec->PrecacheModel(MODEL_MEDKIT);
  pdec->PrecacheTexture(TEXTURE_MEDKIT);
  pdec->PrecacheModel(MODEL_MEDSHOT);
  pdec->PrecacheTexture(TEXTURE_MEDSHOT);

  pdec->PrecacheModel(MODEL_SUPER);
  pdec->PrecacheTexture(TEXTURE_SUPER);
};
%}

class CHealthItem : CItem {
name      "Health Item";
thumbnail "Thumbnails\\HealthItem.tbn";

properties:
  1 enum HealthItemType m_EhitType "Type" 'Y' = HIT_SMALL, // health type
  2 BOOL m_bOverTopHealth  = FALSE, // can be received over top health

components:
  0 class CLASS_BASE "Classes\\Item.ecl",
  1 model MODEL_ITEM "Models\\Items\\ItemHolder.mdl",

// [Cecil] New health
  5 model   MODEL_HANDLER   "Models\\Items\\VitalHandler.mdl",
 10 model   MODEL_MEDKIT    "Models\\Items\\Medkit.mdl",
 11 texture TEXTURE_MEDKIT  "Models\\Items\\Medkit.tex",
 12 model   MODEL_MEDSHOT   "Models\\Items\\Medshot.mdl",
 13 texture TEXTURE_MEDSHOT "Models\\Items\\Medshot.tex",

// ********* SUPER HEALTH *********
 40 model   MODEL_SUPER   "Models\\Items\\Health\\Super\\Super.mdl",
 41 texture TEXTURE_SUPER "Models\\Items\\Health\\Super\\Super.tex",

// ********* MISC *********
 50 texture TEXTURE_SPECULAR_STRONG "Models\\SpecularTextures\\Strong.tex",
 51 texture TEXTURE_SPECULAR_MEDIUM "Models\\SpecularTextures\\Medium.tex",
 52 texture TEXTURE_REFL_LIGHTMETAL "Models\\ReflectionTextures\\LightMetal01.tex",
 53 texture TEXTURE_REFL_GOLD       "Models\\ReflectionTextures\\Gold01.tex",

functions:
  // [Cecil] Precache just in case
  void Precache(void) {
    CHealthItem_Precache();
  };

  // [Cecil] Physics overrides
  virtual ECollisionShape GetPhysCollision(FLOAT3D &vSize) const {
    switch (m_EhitType) {
      case HIT_PILL:
      case HIT_SMALL: vSize = FLOAT3D(0.2f, 0.2f, 0.5f); return COLSH_CAPSULE;
      case HIT_MEDIUM:
      case HIT_LARGE: vSize = FLOAT3D(0.7f, 0.3f, 0.8f); return COLSH_BOX;
      case HIT_SUPER: vSize = FLOAT3D(1, 1, 1); return COLSH_BOX;
    }

    return CItem::GetPhysCollision(vSize);
  };

  virtual BOOL GetPhysOffset(CPlacement3D &plOffset) const {
    switch (m_EhitType) {
      case HIT_PILL:
      case HIT_SMALL: plOffset = CPlacement3D(FLOAT3D(0, 0.1f, 0), ANGLE3D(0, 0, 0)); return TRUE;
      case HIT_MEDIUM:
      case HIT_LARGE: plOffset = CPlacement3D(FLOAT3D(0, 0.15f, 0), ANGLE3D(0, 0, 0)); return TRUE;
      case HIT_SUPER: plOffset = CPlacement3D(FLOAT3D(0, 0.5f, 0), ANGLE3D(0, 0, 0)); return TRUE;
    }

    return CItem::GetPhysOffset(plOffset);
  };

  virtual BOOL UseRealisticPhysics(void) const {
    // Use engine physics with the floating heart
    if (m_EhitType == HIT_SUPER) {
      return FALSE;
    }

    return CItem::UseRealisticPhysics();
  };

  virtual BOOL CanGravityGunInteract(CCecilPlayerEntity *penPlayer) const {
    // Don't interact with the floating heart
    if (m_EhitType == HIT_SUPER) {
      return FALSE;
    }

    return CItem::CanGravityGunInteract(penPlayer);
  };

  /* Fill in entity statistics - for AI purposes only */
  BOOL FillEntityStatistics(EntityStats *pes) {
    pes->es_strName = "Health"; 
    pes->es_ctCount = 1;
    pes->es_ctAmmount = m_fValue;
    pes->es_fValue = m_fValue;
    pes->es_iScore = 0;//m_iScore;
    
    switch (m_EhitType) {
      case HIT_PILL:   pes->es_strName+=" pill";   break;
      case HIT_SMALL:  pes->es_strName+=" small";  break;
      case HIT_MEDIUM: pes->es_strName+=" medium"; break;
      case HIT_LARGE:  pes->es_strName+=" large";  break;
      case HIT_SUPER:  pes->es_strName+=" super";  break;
    }

    return TRUE;
  };

  // set health properties depending on health type
  void SetProperties(void) {
    StartModelAnim(ITEMHOLDER_ANIM_DEFAULT_ANIMATION, AOF_LOOPING|AOF_NORESTART);
    ForceCollisionBoxIndexChange(ITEMHOLDER_COLLISION_BOX_MEDIUM);

    switch (m_EhitType) {
      // [Cecil] Pills and small ones are the same but pills are allowed to go over
      case HIT_PILL:
      case HIT_SMALL: {
        m_fValue = 10.0f;
        m_bOverTopHealth = (m_EhitType == HIT_PILL);
        m_fRespawnTime = (m_fCustomRespawnTime > 0) ? m_fCustomRespawnTime : 10.0f; 
        m_strDescription.PrintF("Small - H:%g  T:%g", m_fValue, m_fRespawnTime);

        // set appearance
        AddItem(MODEL_HANDLER, TEXTURE_MEDSHOT, 0, 0, 0);
        AddItemAttachment(VITALHANDLER_ATTACHMENT_MEDSHOT, MODEL_MEDSHOT, TEXTURE_MEDSHOT, 0, 0, 0);
      } break;

      case HIT_MEDIUM:
      case HIT_LARGE: {
        m_fValue = 25.0f;
        m_bOverTopHealth = FALSE;
        m_fRespawnTime = (m_fCustomRespawnTime > 0) ? m_fCustomRespawnTime : 25.0f; 
        m_strDescription.PrintF("Medium - H:%g  T:%g", m_fValue, m_fRespawnTime);

        // set appearance
        AddItem(MODEL_HANDLER, TEXTURE_MEDKIT, 0, 0, 0);
        AddItemAttachment(VITALHANDLER_ATTACHMENT_MEDKIT, MODEL_MEDKIT, TEXTURE_MEDKIT, 0, 0, 0);
      } break;

      case HIT_SUPER:
        StartModelAnim(ITEMHOLDER_ANIM_MEDIUMOSCILATION, AOF_LOOPING|AOF_NORESTART);

        m_fValue = 100.0f;
        m_bOverTopHealth = TRUE;
        m_fRespawnTime = (m_fCustomRespawnTime > 0) ? m_fCustomRespawnTime : 120.0f; 
        m_strDescription.PrintF("Super - H:%g  T:%g", m_fValue, m_fRespawnTime);
        // set appearance
        AddItem(MODEL_SUPER, TEXTURE_SUPER, 0, TEXTURE_SPECULAR_MEDIUM, 0);
        StretchItem(FLOAT3D(0.75f, 0.75f, 0.75));
        CModelObject &mo = GetModelObject()->GetAttachmentModel(ITEMHOLDER_ATTACHMENT_ITEM)->amo_moModelObject;
        mo.PlayAnim(0, AOF_LOOPING);
        break;
    }

    if (m_EhitType != HIT_SUPER) {
      // [Cecil] Flare and bigger size
      AddFlare();
      StretchItem(FLOAT3D(2.0f, 2.0f, 2.0f));
    }
  };

  void AdjustDifficulty(void) {
    if (!GetSP()->sp_bAllowHealth && m_penTarget == NULL) {
      Destroy();
      return;
    }

    // [Cecil] Reload model
    RemoveSeeThroughFlag();

    SetModel(MODEL_ITEM);
    SetProperties();
  };

  // [Cecil]
  virtual BOOL IsItemLocal(void) const {
    return GetSP()->sp_bHealthArmorStays;
  };

procedures:
  ItemCollected(EPass epass) : CItem::ItemCollected {
    ASSERT(epass.penOther!=NULL);

    // if health stays
    if (IsItemLocal() && !(m_bPickupOnce||m_bRespawn)) {
      // if already picked by this player
      BOOL bWasPicked = MarkPickedBy(epass.penOther);
      if (bWasPicked) {
        // don't pick again
        return;
      }
    }

    // send health to entity
    EHealth eHealth;
    eHealth.fHealth = m_fValue;
    eHealth.bOverTopHealth = m_bOverTopHealth;
    // if health is received
    if (epass.penOther->ReceiveItem(eHealth)) {
      if (!IsItemLocal() || (m_bPickupOnce||m_bRespawn)) {
        jump CItem::ItemReceived();
      }
    }
    return;
  };

  Main() {
    Initialize(); // initialize base class
    SetProperties(); // set properties

    jump CItem::ItemLoop();
  };
};
