800
%{
#include "StdH.h"
#include "Models/Items/ItemHolder/ItemHolder.h"

// [Cecil] Gravity Gun actions
#include "EntitiesMP/Cecil/Physics.h"
// [Cecil] Roller Mine spawning
#include "EntitiesMP/Mod/RollerMine.h"

// [Cecil] Static items on the ground
#define EPF_GROUND_ITEM (EPF_COLLIDEWITHCUSTOM | EPF_COLLIDEWITHCUSTOM_EXCL | \
  EPF_ONBLOCK_STOPEXACT|EPF_PUSHABLE|EPF_MOVABLE|EPF_TRANSLATEDBYGRAVITY|EPF_ORIENTEDBYGRAVITY)
%}

// [Cecil] New base class
uses "EntitiesMP/Mod/PhysBase";

%{
// used to render certain entities only for certain players (like picked items, etc.)
extern ULONG _ulPlayerRenderingMask;
%}

class export CItem : CPhysBase {
name      "Item";
thumbnail "";
features  "HasName", "HasDescription", "IsTargetable", "CanBePredictable";

properties:
  1 CTString m_strName            "Name" 'N' = "Item",
  2 CTString m_strDescription = "",

  // class properties
  5 FLOAT m_fValue = 0.0f,                                 // value
  6 FLOAT m_fRespawnTime = 0.0f,                           // default respawn time
 26 FLOAT m_fCustomRespawnTime "Respawn Time" = 0.0f,      // custom respawn time
  7 BOOL m_bRespawn "Respawn" 'R' = FALSE,    // respawn item
  8 CEntityPointer m_penTarget  "Target" 'T' COLOR(C_dGRAY|0xFF),   // target to trigger when crossed over
  9 BOOL m_bPickupOnce  "PickupOnce" 'P' = FALSE,   // can be picked by only one player, triggers only when really picked
 10 CSoundObject m_soPick,      // sound channel
 12 FLOAT m_fPickSoundLen = 0.0f,
 14 BOOL m_bDropped = FALSE,    // dropped by a player during a deathmatch game
 15 INDEX m_ulPickedMask = 0,   // mask for which players picked this item
 16 BOOL m_bFloating "Floating" 'F' = FALSE,

 // [Cecil] How long to stay dropped
 50 FLOAT m_fDropTime = 10.0f,

 51 BOOL m_bGravityGunInteract "Gravity gun can interact" = TRUE,

components:
  1 model MODEL_ITEM "Models\\Items\\ItemHolder.mdl",

// [Cecil] Classes
 10 class CLASS_ROLLERMINE "Classes\\RollerMine.ecl",

functions:
  // [Cecil] Physics overrides
  virtual INDEX GetPhysMaterial(void) const { return SUR_PLASTIC_NORMAL; };
  virtual BOOL AreDecalsAllowed(void) const { return FALSE; };

  virtual ECollisionShape GetPhysCollision(FLOAT3D &vSize) const {
    vSize = FLOAT3D(1, 1, 1);
    return COLSH_BOX;
  };

  virtual BOOL GetPhysOffset(CPlacement3D &plOffset) const {
    plOffset = CPlacement3D(FLOAT3D(0, 0.5f, 0), ANGLE3D(0, 0, 0));
    return TRUE;
  };

  virtual BOOL UseRealisticPhysics(void) const {
    // Disable item physics
    if (!(GetSP()->sp_iPhysFlags & PHYSF_ITEMS)) {
      return FALSE;
    }

    // Use engine physics with respawning items
    if (m_bRespawn) {
      return FALSE;
    }

    return CPhysBase::UseRealisticPhysics();
  };

  virtual BOOL CanGravityGunInteract(CCecilPlayerEntity *penPlayer) const {
    // Ignore respawning and invisible items
    if (!m_bGravityGunInteract || m_bRespawn || en_RenderType == RT_EDITORMODEL || en_RenderType == RT_SKAEDITORMODEL) {
      return FALSE;
    }

    // Check if it's already been picked up by the player
    const INDEX iPlayer = penPlayer->GetMyPlayerIndex();
    const BOOL bAlreadyPicked = (1 << iPlayer) & m_ulPickedMask;

    return !bAlreadyPicked;
  };

  virtual BOOL CanGravityGunPickUp(void) const {
    // Only if it doesn't respawn
    return !m_bRespawn;
  };

  virtual FLOAT GetPhysMass(void) const { return 0.5f; };
  virtual FLOAT GetPhysFriction(void) const { return 0.7f; };
  virtual FLOAT GetPhysBounce(void) const { return 0.7f; };

  void ReceiveDamage(CEntity *penInflictor, enum DamageType dmtType, FLOAT fDamage, const FLOAT3D &vHitPoint, const FLOAT3D &vDirection) {
    if (PhysicsUsable()) {
      CPhysBase::ReceiveDamage(penInflictor, dmtType, fDamage, vHitPoint, vDirection);
    } else {
      CCecilMovableModelEntity::ReceiveDamage(penInflictor, dmtType, fDamage, vHitPoint, vDirection);
    }
  };

  virtual void AdjustDifficulty(void)
  {
  }

  /* Adjust model mip factor if needed. */
  void AdjustMipFactor(FLOAT &fMipFactor)
  {
    // adjust flare glow, to decrease power with how you get closer
    CAttachmentModelObject *pamo = GetModelObject()->GetAttachmentModel(ITEMHOLDER_ATTACHMENT_FLARE);
    if( pamo != NULL)
    {
      FLOAT fRatio = (Clamp( fMipFactor, 5.0f, 7.0f)-5.0f)/2.0f;
      UBYTE ubRatio = UBYTE(255*fRatio);
      COLOR colMutiply = RGBToColor(ubRatio,ubRatio,ubRatio)|CT_OPAQUE;
      pamo->amo_moModelObject.mo_colBlendColor = colMutiply;
    }

    // if never picked
    if (m_ulPickedMask==0) {
      // don't bother testing
      return;
    }

    BOOL bFlare = TRUE;
    // if current player has already picked this item
    if (_ulPlayerRenderingMask&m_ulPickedMask) {
      // if picked items are not rendered
      extern INDEX plr_bRenderPicked;
      if (!plr_bRenderPicked) {
        // kill mip factor
        fMipFactor = UpperLimit(0.0f);
      }
      // if picked item particles are not rendered
      extern INDEX plr_bRenderPickedParticles;
      if (!plr_bRenderPickedParticles) {
        // kill flare 
        bFlare = FALSE;
      }
    }

    // implement flare on/off ?
  }

  // check whether should render particles for this item
  BOOL ShowItemParticles(void)
  {
    // if current player has already picked this item
    if (_ulPlayerRenderingMask&m_ulPickedMask) {
      // if picked item particles are not rendered
      extern INDEX plr_bRenderPickedParticles;
      if (!plr_bRenderPickedParticles) {
        // don't render
        return FALSE;
      }
    }
    // otherwise, render
    return TRUE;
  }

  // check if given player already picked this item, and mark if not
  BOOL MarkPickedBy(CEntity *pen)
  {
    if (!IS_PLAYER(pen)) {
      return FALSE;
    }
    INDEX iPlayer = ((CCecilPlayerEntity *)pen)->GetMyPlayerIndex();
    BOOL bPickedAlready = (1<<iPlayer)&m_ulPickedMask;
    m_ulPickedMask |= (1<<iPlayer);
    return bPickedAlready;
  }

  // get maximum allowed range for predicting this entity
  FLOAT GetPredictionRange(void)
  {
    extern FLOAT cli_fPredictItemsRange;
    return cli_fPredictItemsRange;
  }

  /* Adjust model shading parameters if needed. */
  BOOL AdjustShadingParameters(FLOAT3D &vLightDirection, COLOR &colLight, COLOR &colAmbient)
  {
    // in DM, glares are off, so add some light to items
    //if( m_bRespawn)
    {
      // fixed light and ambient
      colLight   = 0x40404040;
      colAmbient = 0x60606060;
    }
    /*
    else
    {
      // fixed light and ambient
      colLight   = 0x30303030;
      colAmbient = 0x30303030;
    }
    */

    // light direction always from upper left corner relative to the object
    vLightDirection = FLOAT3D(-1,-1,-1);
    vLightDirection.Normalize();
    vLightDirection*=GetRotationMatrix();

    // no shadow
    return FALSE;
  };

/************************************************************
 *                      INITALIZATION                       *
 ************************************************************/
  void Initialize(void) {
    InitAsModel();

    // [Cecil] Only set see-through flag if respawning
    if (m_bRespawn) {
      SetFlags(GetFlags() | ENF_SEETHROUGH);
    } else {
      SetFlags(GetFlags() & ~ENF_SEETHROUGH);
    }

    SetItemFlags(FALSE);

    // make items not slide that much
    en_fDeceleration = 60.0f;

    // set appearance
    SetModel(MODEL_ITEM);
    SetDesiredTranslation(FLOAT3D(0,0,0));  // just to add to movers
  };

  // [Cecil] Set appropriate flags for the item
  void SetItemFlags(BOOL bRealisticPhysics) {
    // [Cecil] Set flags for realistic physics
    if (bRealisticPhysics) {
      SetPhysicsFlags(EPF_BRUSH_MOVING | EPF_CUSTOMCOLLISION);
      SetCollisionFlags(ECF_PHYS_TESTALL | ECF_PHYS_ISMODEL | ((ECBI_MODEL | ECBI_PLAYER) << ECB_PASS));

    } else {
      if (m_bFloating) {
        SetPhysicsFlags(EPF_MODEL_FLYING);

      // [Cecil] Items that respawn shouldn't slide around
      } else if (m_bRespawn) {
        SetPhysicsFlags(EPF_GROUND_ITEM);

      } else {
        SetPhysicsFlags(EPF_MODEL_SLIDING);
      }

      SetCollisionFlags(ECF_ITEM);
    }
  };

/************************************************************
 *                   SET MODEL AND ATTACHMENT               *
 ************************************************************/
  // Add item
  void AddItem(ULONG ulIDModel, ULONG ulIDTexture,
               ULONG ulIDReflectionTexture, ULONG ulIDSpecularTexture, ULONG ulIDBumpTexture) {
    AddAttachmentToModel(this, *GetModelObject(), ITEMHOLDER_ATTACHMENT_ITEM, ulIDModel, ulIDTexture,
                         ulIDReflectionTexture, ulIDSpecularTexture, ulIDBumpTexture);
  };
  void AddItemSpecial(INDEX iAttachmentPos, ULONG ulIDModel, ULONG ulIDTexture,
               ULONG ulIDReflectionTexture, ULONG ulIDSpecularTexture, ULONG ulIDBumpTexture) {
    AddAttachmentToModel(this, *GetModelObject(), iAttachmentPos, ulIDModel, ulIDTexture,
                         ulIDReflectionTexture, ulIDSpecularTexture, ulIDBumpTexture);
  };

  // Add attachment to item
  void AddItemAttachment(INDEX iAttachment, ULONG ulIDModel, ULONG ulIDTexture,
                         ULONG ulIDReflectionTexture, ULONG ulIDSpecularTexture, ULONG ulIDBumpTexture) {
    CModelObject &mo = GetModelObject()->GetAttachmentModel(ITEMHOLDER_ATTACHMENT_ITEM)->amo_moModelObject;
    AddAttachmentToModel(this, mo, iAttachment, ulIDModel, ulIDTexture,
                         ulIDReflectionTexture, ulIDSpecularTexture, ulIDBumpTexture);
  };
  // set animation of attachment
  void SetItemAttachmentAnim(INDEX iAttachment, INDEX iAnim)
  {
    CModelObject &mo = 
      GetModelObject()->GetAttachmentModel(ITEMHOLDER_ATTACHMENT_ITEM)->amo_moModelObject.
        GetAttachmentModel(iAttachment)->amo_moModelObject;
    mo.PlayAnim(iAnim, 0);
  }

  // Stretch item
  void StretchItem(const FLOAT3D &vStretch) {
    CModelObject &mo = GetModelObject()->GetAttachmentModel(ITEMHOLDER_ATTACHMENT_ITEM)->amo_moModelObject;
    mo.StretchModel(vStretch);
    ModelChangeNotify();
  };

  // returns bytes of memory used by this object
  SLONG GetUsedMemory(void)
  {
    // initial
    SLONG slUsedMemory = sizeof(CItem) - sizeof(CPhysBase) + CPhysBase::GetUsedMemory();
    // add some more
    slUsedMemory += m_strDescription.Length();
    slUsedMemory += m_strName.Length();
    slUsedMemory += 1* sizeof(CSoundObject);
    return slUsedMemory;
  }



procedures:

/************************************************************
 *          VIRTUAL PROCEDURES THAT NEED OVERRIDE           *
 ************************************************************/
  ItemCollected(EPass epass) { return; };



/************************************************************
 *                I  T  E  M    L  O  O  P                  *
 ************************************************************/

  ItemLoop(EVoid) {
    m_fCustomRespawnTime = ClampDn( m_fCustomRespawnTime, 0.0f);
    autowait(0.1f);

    // [Cecil] Spawn rollermines
    if (GetSP()->sp_iHLGamemode == HLGM_MINEKILL && (IsOfClass(this, "Ammo Item") || IsOfClass(this, "Weapon Item"))) {
      CPlacement3D plMine = GetPlacement();
      plMine.pl_PositionVector += FLOAT3D(0, 1, 0) * GetRotationMatrix();

      CEntity *pen = CreateEntity(plMine, CLASS_ROLLERMINE);
      ((CRollerMine *)pen)->m_bTakeDamage = TRUE;
      pen->Initialize();
    }

    SetPredictable(TRUE);
    AdjustDifficulty();

    // [Cecil] Readjust the flags
    SetItemFlags(PhysicsUsable());

    wait() {
      on (EBegin) : { resume; }
      on (EPass epass) : { 
        if (!IS_PLAYER(epass.penOther)) {
          pass;
        }
        if (!(m_bPickupOnce||m_bRespawn)) {
          SendToTarget(m_penTarget, EET_TRIGGER, epass.penOther);
          m_penTarget = NULL;
        }
        call ItemCollected(epass); 
      }

      // [Cecil] Physics simulation
      on (EPhysicsStart) : {
        SetItemFlags(TRUE);
        resume;
      }

      on (EPhysicsStop) : {
        SetItemFlags(FALSE);

        // Adjust item placement to prevent it from falling through the floor
        ANGLE3D aGravity;
        UpVectorToAngles(-en_vGravityDir, aGravity);
        aGravity(1) = GetPlacement().pl_OrientationAngle(1);

        Teleport(CPlacement3D(PhysObj().GetPosition(), aGravity), FALSE);
        ForceFullStop();
        resume;
      }

      on (EEnd) : { stop; }
    }

    // [Cecil] Drop this object
    GravityGunObjectDrop(m_syncGravityGun);

    // [Cecil] Destory physics object and update objects around the item
    PhysObj().Clear(TRUE);

    if (_penGlobalController != NULL) {
      _penGlobalController->UpdatePhysObjects(FLOATaabbox3D(GetPlacement().pl_PositionVector, 8.0f));
    }

    // wait for sound to end
    autowait(m_fPickSoundLen+0.5f);
    // cease to exist
    Destroy();
    return;
  };

  ItemReceived(EVoid)
  {
    // hide yourself
    SwitchToEditorModel();
    if ((m_bPickupOnce||m_bRespawn)) {
      SendToTarget(m_penTarget, EET_TRIGGER, NULL);
    }

    // respawn item
    if (m_bRespawn) {
      ASSERT(m_fRespawnTime>0.0f);

      // wait to respawn
      wait(m_fRespawnTime) {
        on (EBegin) : { resume; }
        on (ETimer) : { stop; }
        otherwise() : { resume; }
      }
      // show yourself
      SwitchToModel();
    
    // cease to exist
    } else {
      return EEnd();
    }
    return;
  };
};

