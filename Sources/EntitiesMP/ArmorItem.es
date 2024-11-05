804
%{
#include "StdH.h"
#include "Models/Items/ItemHolder/ItemHolder.h"

// [Cecil] Half-Life 2 Armor
#include "HL2Models/VitalHandler.h"
%}

uses "EntitiesMP/Item";

// health type 
enum ArmorItemType {
  0 ARIT_SHARD  "Shard",  // shard
  1 ARIT_SMALL  "Small",  // small armor
  2 ARIT_MEDIUM "Medium", // medium armor
  3 ARIT_STRONG "Strong", // strong armor
  4 ARIT_SUPER  "Super",  // super armor
  5 ARIT_HELM   "Helm",   // helm
};

// event for sending through receive item
event EArmor {
  FLOAT fArmor,         // armor to receive
  BOOL bOverTopArmor,   // can be received over top armor
};

%{
// [Cecil] Extracted from entity functions
void CArmorItem_Precache(void) {
  CDLLEntityClass *pdec = &CArmorItem_DLLClass;

  pdec->PrecacheModel(MODEL_HANDLER);
  pdec->PrecacheModel(MODEL_SUIT);
  pdec->PrecacheTexture(TEXTURE_SUIT);
  pdec->PrecacheModel(MODEL_BODY);
  pdec->PrecacheModel(MODEL_BATTERY);
  pdec->PrecacheTexture(TEXTURE_BATTERY);
};
%}

class CArmorItem : CItem {
name      "Armor Item";
thumbnail "Thumbnails\\ArmorItem.tbn";

properties:
  1 enum ArmorItemType m_EaitType     "Type" 'Y' = ARIT_SHARD,    // armor type
  2 BOOL m_bOverTopArmor  = FALSE,   // can be received over top armor

components:
  0 class CLASS_BASE "Classes\\Item.ecl",
  1 model MODEL_ITEM "Models\\Items\\ItemHolder.mdl",

// [Cecil] New armor
  5 model   MODEL_HANDLER   "Models\\Items\\VitalHandler.mdl",
 10 model   MODEL_SUIT      "Models\\Items\\HevSuit.mdl",
 11 texture TEXTURE_SUIT    "Models\\Items\\HevSuit.tex",
 12 model   MODEL_BODY      "Models\\Items\\HevBody.mdl",
 13 model   MODEL_BATTERY   "Models\\Items\\Battery.mdl",
 14 texture TEXTURE_BATTERY "Models\\Items\\Battery.tex",

// ************** REFLECTIONS **************
200 texture TEX_REFL_LIGHTMETAL01 "Models\\ReflectionTextures\\LightMetal01.tex",

// ************** SPECULAR **************
210 texture TEX_SPEC_MEDIUM "Models\\SpecularTextures\\Medium.tex",

functions:
  // [Cecil] Precache just in case
  void Precache(void) {
    CArmorItem_Precache();
  };

  // [Cecil] Physics overrides
  virtual ECollisionShape GetPhysCollision(FLOAT3D &vSize) const {
    switch (m_EaitType) {
      case ARIT_SHARD:
      case ARIT_SMALL:
      case ARIT_MEDIUM:
      case ARIT_HELM:   vSize = FLOAT3D(0.2f, 0.3f, 0.5f); return COLSH_BOX;
      case ARIT_STRONG: vSize = FLOAT3D(0.8f, 1.0f, 0.6f); return COLSH_BOX;
      case ARIT_SUPER:  vSize = FLOAT3D(0.75f, 1.9f, 0.4f); return COLSH_BOX;
    }

    return CItem::GetPhysCollision(vSize);
  };

  virtual BOOL GetPhysOffset(CPlacement3D &plOffset) const {
    switch (m_EaitType) {
      case ARIT_SHARD:
      case ARIT_SMALL:
      case ARIT_MEDIUM:
      case ARIT_HELM:   plOffset = CPlacement3D(FLOAT3D(0, 0.15f, 0), ANGLE3D(0, 0, 0)); return TRUE;
      case ARIT_STRONG: plOffset = CPlacement3D(FLOAT3D(0, 0.5f, 0.05f), ANGLE3D(0, 0, 0)); return TRUE;
      case ARIT_SUPER:  plOffset = CPlacement3D(FLOAT3D(0, 0.95f, 0), ANGLE3D(0, 0, 0)); return TRUE;
    }

    return CItem::GetPhysOffset(plOffset);
  };

  /* Fill in entity statistics - for AI purposes only */
  BOOL FillEntityStatistics(EntityStats *pes) {
    pes->es_strName = "Armor"; 
    pes->es_ctCount = 1;
    pes->es_ctAmmount = m_fValue;
    pes->es_fValue = m_fValue*2;
    pes->es_iScore = 0;//m_iScore;
    switch (m_EaitType) {
      case ARIT_SHARD:  pes->es_strName+=" shard";  break;
      case ARIT_SMALL:  pes->es_strName+=" small";  break;                                      
      case ARIT_MEDIUM: pes->es_strName+=" medium"; break;
      case ARIT_STRONG: pes->es_strName+=" strong"; break;
      case ARIT_SUPER:  pes->es_strName+=" super";  break;
      case ARIT_HELM:   pes->es_strName+=" helm";   break;
    }
    return TRUE;
  };

  // set health properties depending on health type
  void SetProperties(void) {
    StartModelAnim(ITEMHOLDER_ANIM_DEFAULT_ANIMATION, AOF_LOOPING|AOF_NORESTART);
    ForceCollisionBoxIndexChange(ITEMHOLDER_COLLISION_BOX_SMALL);

    switch (m_EaitType) {
      case ARIT_SHARD:
      case ARIT_SMALL:
      case ARIT_MEDIUM:
      case ARIT_HELM:
        m_fValue = 15.0f;
        m_bOverTopArmor = FALSE;
        m_fRespawnTime = (m_fCustomRespawnTime > 0) ? m_fCustomRespawnTime : 10.0f; 
        m_strDescription.PrintF("Battery - H:%g  T:%g", m_fValue, m_fRespawnTime);

        // set appearance
        AddItem(MODEL_HANDLER, TEXTURE_BATTERY, 0, 0, 0);
        AddItemAttachment(VITALHANDLER_ATTACHMENT_BATTERY, MODEL_BATTERY, TEXTURE_BATTERY, 0, 0, 0);
        break;

      case ARIT_STRONG:
        ForceCollisionBoxIndexChange(ITEMHOLDER_COLLISION_BOX_MEDIUM);
        m_fValue = 100.0f;
        m_bOverTopArmor = FALSE;
        m_fRespawnTime = (m_fCustomRespawnTime>0) ? m_fCustomRespawnTime : 60.0f; 
        m_strDescription.PrintF("Strong - H:%g  T:%g", m_fValue, m_fRespawnTime);

        // set appearance
        AddItem(MODEL_HANDLER, TEXTURE_SUIT, 0, 0, 0);
        AddItemAttachment(VITALHANDLER_ATTACHMENT_SUIT, MODEL_BODY, TEXTURE_SUIT, 0, 0, 0);
        break;

      case ARIT_SUPER:
        ForceCollisionBoxIndexChange(ITEMHOLDER_COLLISION_BOX_MEDIUM);
        m_fValue = 200.0f;
        m_bOverTopArmor = TRUE;
        m_fRespawnTime = (m_fCustomRespawnTime>0) ? m_fCustomRespawnTime : 120.0f; 
        m_strDescription.PrintF("Super - H:%g  T:%g", m_fValue, m_fRespawnTime);

        // set appearance
        AddItem(MODEL_HANDLER, TEXTURE_SUIT, 0, 0, 0);
        AddItemAttachment(VITALHANDLER_ATTACHMENT_SUIT, MODEL_SUIT, TEXTURE_SUIT, 0, 0, 0);
        break;
    }

    // [Cecil] Random rotation and bigger size
    //GetModelObject()->GetAttachmentModel(ITEMHOLDER_ATTACHMENT_ITEM)->amo_plRelative.pl_OrientationAngle(1) = FRnd() * 360.0f;
    StretchItem(FLOAT3D(2.0f, 2.0f, 2.0f));
  };

  void AdjustDifficulty(void) {
    if (!GetSP()->sp_bAllowArmor && m_penTarget==NULL) {
      Destroy();
      return;
    }

    // [Cecil] Reload model
    if (!m_bRespawn) {
      SetFlags(GetFlags() & ~ENF_SEETHROUGH);
    }

    SetModel(MODEL_ITEM);
    SetProperties();
  };

procedures:
  ItemCollected(EPass epass) : CItem::ItemCollected {
    ASSERT(epass.penOther!=NULL);

    // if armor stays
    if (GetSP()->sp_bHealthArmorStays && !(m_bPickupOnce||m_bRespawn)) {
      // if already picked by this player
      BOOL bWasPicked = MarkPickedBy(epass.penOther);
      if (bWasPicked) {
        // don't pick again
        return;
      }
    }

    // send health to entity
    EArmor eArmor;
    eArmor.fArmor = m_fValue;
    eArmor.bOverTopArmor = m_bOverTopArmor;

    // if health is received
    if (epass.penOther->ReceiveItem(eArmor)) {
      if (!GetSP()->sp_bHealthArmorStays || (m_bPickupOnce||m_bRespawn)) {
        jump CItem::ItemReceived();
      }
    }
    return;
  };

  Main() {
    Initialize(); // initialize base class
    SetProperties(); // set properties

    // [Cecil] Added dropped actions
    if (!m_bDropped) {
      jump CItem::ItemLoop();
    } else if (TRUE) {
      wait() {
        on (EBegin) : {
          SpawnReminder(this, m_fDropTime, 0);
          call CItem::ItemLoop();
        }
        on (EReminder) : {
          SendEvent(EEnd()); 
          resume;
        }
      }
    }
  };
};
